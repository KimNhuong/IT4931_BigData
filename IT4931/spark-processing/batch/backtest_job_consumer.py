import os
import json
from pyspark.sql import SparkSession
from pyspark.sql.window import Window
from pyspark.sql.functions import col, avg, lag, when, sum as spark_sum, month, year, broadcast, from_json, struct, to_json
from pyspark.sql.types import StructType, StructField, StringType, IntegerType

# Configuration
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
KAFKA_SASL_USERNAME = os.getenv("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASSWORD = os.getenv("KAFKA_SASL_PASSWORD", "")
KAFKA_SASL_MECHANISM = os.getenv("KAFKA_SASL_MECHANISM", "SCRAM-SHA-256").upper()
CA_CERT_TXT = os.getenv("KAFKA_CA_CERT", "").replace("\\n", "\n")
CA_CERT_PATH = "/tmp/aiven_ca.pem"

if CA_CERT_TXT:
    with open(CA_CERT_PATH, "w") as f:
        f.write(CA_CERT_TXT)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "binance-data")
SYMBOL_METADATA_PATH = "/app/data/symbol_metadata.csv"

def get_kafka_options():
    options = {
        "kafka.bootstrap.servers": KAFKA_BROKER,
        "kafka.ssl.endpoint.identification.algorithm": "https"
    }
    if KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD:
        options["kafka.security.protocol"] = "SASL_SSL"
        options["kafka.sasl.mechanism"] = KAFKA_SASL_MECHANISM
        if "SCRAM" in KAFKA_SASL_MECHANISM.upper():
            options["kafka.sasl.jaas.config"] = f'org.apache.kafka.common.security.scram.ScramLoginModule required username="{KAFKA_SASL_USERNAME}" password="{KAFKA_SASL_PASSWORD}";'
        else:
            options["kafka.sasl.jaas.config"] = f'org.apache.kafka.common.security.plain.PlainLoginModule required username="{KAFKA_SASL_USERNAME}" password="{KAFKA_SASL_PASSWORD}";'
        
        if os.path.exists(CA_CERT_PATH):
            options["kafka.ssl.truststore.location"] = CA_CERT_PATH
            options["kafka.ssl.truststore.type"] = "PEM"
    return options

def create_spark_session():
    return SparkSession.builder \
        .appName("BacktestJobConsumer") \
        .config("spark.hadoop.fs.s3a.endpoint", MINIO_ENDPOINT) \
        .config("spark.hadoop.fs.s3a.access.key", MINIO_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", MINIO_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def calculate_strategy_performance(df, spark):
    # 2. Window Functions
    windowSpecShort = Window.partitionBy("symbol").orderBy("timestamp").rowsBetween(-5, 0)
    windowSpecLong = Window.partitionBy("symbol").orderBy("timestamp").rowsBetween(-20, 0)

    df_signals = df.withColumn("MA5", avg("price").over(windowSpecShort)) \
                   .withColumn("MA20", avg("price").over(windowSpecLong))

    # Signal Logic: Buy when MA5 > MA20
    df_signals = df_signals.withColumn("signal", when(col("MA5") > col("MA20"), 1).otherwise(0)) \
                           .withColumn("prev_signal", lag("signal", 1).over(Window.partitionBy("symbol").orderBy("timestamp")))

    # 3. Broadcast Join
    metadata_df = spark.read.csv(SYMBOL_METADATA_PATH, header=True)
    df_enriched = df_signals.join(broadcast(metadata_df), "symbol", "left")

    # 4. Calculate PnL
    df_pnl = df_enriched.withColumn("price_change", col("price") - lag("price", 1).over(Window.partitionBy("symbol").orderBy("timestamp"))) \
                        .withColumn("daily_pnl", col("prev_signal") * col("price_change"))

    # 5. Aggregate overall PnL for simplicity in response
    total_pnl = df_pnl.agg(spark_sum("daily_pnl").alias("total_profit")).collect()[0]["total_profit"]
    
    # 6. Spark MLlib (Linear Regression)
    from pyspark.ml.feature import VectorAssembler
    from pyspark.ml.regression import LinearRegression

    ml_df = df_signals.select("MA5", "MA20", "price").dropna()
    assembler = VectorAssembler(inputCols=["MA5", "MA20"], outputCol="features")
    ml_data = assembler.transform(ml_df).select("features", col("price").alias("label"))

    lr = LinearRegression(maxIter=10, regParam=0.3, elasticNetParam=0.8)
    lr_model = lr.fit(ml_data)
    rmse = lr_model.summary.rootMeanSquaredError

    return {
        "totalProfit": total_pnl if total_pnl is not None else 0.0,
        "rmse": rmse,
        "strategy": "MA Crossover (MA5 > MA20)"
    }

def process_batch(df, epoch_id, spark):
    if df.count() > 0:
        kafka_opts = get_kafka_options()
        jobs = df.collect()
        for job_row in jobs:
            job_data = job_row["data"]
            job_id = job_data.get("jobId")
            symbol = job_data.get("symbol")
            strategy = job_data.get("strategy")

            print(f"Processing Backtest Job: {job_id} for {symbol} with strategy {strategy}")

            # 1. Kéo dữ liệu quá khứ từ MinIO
            try:
                minio_path = f"s3a://{MINIO_BUCKET}/historical_ticks/symbol={symbol}"
                historical_df = spark.read.parquet(minio_path)
                
                # Chạy logic chiến lược
                metrics = calculate_strategy_performance(historical_df, spark)
                
                result_payload = {
                    "jobId": job_id,
                    "symbol": symbol,
                    "metrics": metrics,
                    "status": "DONE"
                }
            except Exception as e:
                print(f"Error processing job {job_id}: {e}")
                result_payload = {
                    "jobId": job_id,
                    "symbol": symbol,
                    "metrics": None,
                    "status": "FAILED",
                    "error": str(e)
                }

            # Gửi kết quả về Kafka topic 'binance-backtest-results'
            # Dùng dataframe tạm để ghi ra Kafka
            result_df = spark.createDataFrame([Row(value=json.dumps(result_payload))])
            result_df.write \
                .format("kafka") \
                .options(**kafka_opts) \
                .option("topic", "binance-backtest-results") \
                .save()
            print(f"Job {job_id} result sent to Kafka")

def run_consumer():
    spark = create_spark_session()
    kafka_opts = get_kafka_options()
    
    # Định nghĩa schema cho Kafka Message
    schema = StructType([
        StructField("jobId", StringType(), True),
        StructField("symbol", StringType(), True),
        StructField("strategy", StringType(), True)
    ])

    # Đọc Stream từ topic 'binance-backtest-jobs'
    kafka_df = spark.readStream \
        .format("kafka") \
        .options(**kafka_opts) \
        .option("subscribe", "binance-backtest-jobs") \
        .option("startingOffsets", "latest") \
        .load()

    # Parse JSON value
    parsed_df = kafka_df.select(from_json(col("value").cast("string"), schema).alias("data"))

    # Xử lý từng batch request
    global Row
    from pyspark.sql import Row
    query = parsed_df.writeStream \
        .foreachBatch(lambda df, epochId: process_batch(df, epochId, spark)) \
        .start()

    query.awaitTermination()

if __name__ == "__main__":
    run_consumer()
