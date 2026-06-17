from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr, year, month, dayofmonth
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType, BooleanType
import os

# ----------------------------------------------------
# Xử lý KAFKA_CA_CERT từ Hugging Face Secret thành File vật lý
# ----------------------------------------------------
CA_CERT_TXT = os.getenv("KAFKA_CA_CERT", "")
CA_CERT_PATH = "/tmp/aiven_ca.pem"

if CA_CERT_TXT:
    # Ghi chuỗi cert từ secret ra một file tạm trong container
    with open(CA_CERT_PATH, "w") as f:
        f.write(CA_CERT_TXT)
    print(f"-> Đã khởi tạo thành công file chứng chỉ CA tại: {CA_CERT_PATH}")
else:
    print("⚠️ CẢNH BÁO: Không tìm thấy KAFKA_CA_CERT trong môi trường!")

# Configuration từ Hugging Face Secrets
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "")
KAFKA_SASL_USERNAME = os.getenv("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASSWORD = os.getenv("KAFKA_SASL_PASSWORD", "")
KAFKA_SASL_MECHANISM = os.getenv("KAFKA_SASL_MECHANISM", "SCRAM-SHA-256")

KAFKA_RAW_TOPIC = "binance-raw-ticks"
KAFKA_LIVE_TICKS_TOPIC = "binance-live-ticks"
KAFKA_LIVE_OHLC_TOPIC = "binance-live-ohlc"
KAFKA_WHALE_ALERTS_TOPIC = "binance-whale-alerts"

WHALE_THRESHOLD_USD = float(os.getenv("WHALE_THRESHOLD_USD", "100000"))

# MongoDB Atlas (Ưu tiên dùng MONGODB_URI nếu MONGO_URI trống)
MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or ""
MONGO_DATABASE = "binance"

# AWS S3 Configuration
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "")
S3_BUCKET = os.getenv("S3_BUCKET", "binance-data-it4931")
CHECKPOINT_LOCATION = f"s3a://{S3_BUCKET}/checkpoints/ohlc_aggregator"

# Schema Kafka (aggTrade)
schema = StructType([
    StructField("symbol", StringType()),
    StructField("price", DoubleType()),
    StructField("volume", DoubleType()),
    StructField("timestamp", LongType()),
    StructField("tradeId", LongType()),
    StructField("isMaker", BooleanType())
])

def create_spark_session():
    # Spark 3.4.x / 3.5.x packages
    packages = [
        "org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.1",
        "org.apache.hadoop:hadoop-aws:3.3.4",
        "org.mongodb.spark:mongo-spark-connector_2.12:10.2.1"
    ]
    return SparkSession.builder \
        .appName("BinanceRealTimeProcessor") \
        .config("spark.jars.packages", ",".join(packages)) \
        .config("spark.sql.shuffle.partitions", "2") \
        .config("spark.mongodb.write.connection.uri", MONGO_URI) \
        .config("spark.mongodb.write.database", MONGO_DATABASE) \
        .config("spark.hadoop.fs.s3a.access.key", AWS_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", AWS_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def get_kafka_options():
    options = {"kafka.bootstrap.servers": KAFKA_BROKER}
    
    # Cấu hình bảo mật nâng cao kết hợp SASL và SSL CA Certificate cho Aiven
    if KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD:
        options["kafka.security.protocol"] = "SASL_SSL"
        options["kafka.sasl.mechanism"] = KAFKA_SASL_MECHANISM
        
        # Cấu hình JAAS dựa trên cơ chế SCRAM/PLAIN
        if "SCRAM" in KAFKA_SASL_MECHANISM.upper():
            options["kafka.sasl.jaas.config"] = f'org.apache.kafka.common.security.scram.ScramLoginModule required username="{KAFKA_SASL_USERNAME}" password="{KAFKA_SASL_PASSWORD}";'
        else:
            options["kafka.sasl.jaas.config"] = f'org.apache.kafka.common.security.plain.PlainLoginModule required username="{KAFKA_SASL_USERNAME}" password="{KAFKA_SASL_PASSWORD}";'
        
        # Chỉ định file CA chứng chỉ vừa tạo từ Secret
        if os.path.exists(CA_CERT_PATH):
            options["kafka.ssl.truststore.location"] = CA_CERT_PATH
            options["kafka.ssl.truststore.type"] = "PEM"

    return options

def process_stream():
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")
    kafka_opts = get_kafka_options()

    # Read from Kafka
    raw_df = spark.readStream \
        .format("kafka") \
        .options(**kafka_opts) \
        .option("subscribe", KAFKA_RAW_TOPIC) \
        .option("startingOffsets", "latest") \
        .option("failOnDataLoss", "false") \
        .load()

    # Parse JSON
    parsed_df = raw_df.selectExpr("CAST(value AS STRING)") \
        .select(from_json(col("value"), schema).alias("data")) \
        .select("data.*") \
        .withColumn("event_time", (col("timestamp") / 1000).cast("timestamp")) \
        .withColumn("year", year(col("event_time"))) \
        .withColumn("month", month(col("event_time"))) \
        .withColumn("day", dayofmonth(col("event_time")))

    watermarked_df = parsed_df.withWatermark("event_time", "5 seconds")

    # Aggregation
    ohlc_sliding_df = watermarked_df \
        .groupBy(col("symbol"), window(col("event_time"), "1 minute", "2 seconds")) \
        .agg(
            first("price").alias("open"),
            max("price").alias("high"),
            min("price").alias("low"),
            last("price").alias("close"),
            sum("volume").alias("volume"),
            expr("sum(price * volume) / sum(volume)").alias("vwap")
        ) \
        .select(
            col("symbol"),
            col("window.start").alias("timestamp"),
            col("open"), col("high"), col("low"), col("close"), col("volume"), col("vwap")
        )

    def save_all(batch_df, batch_id):
        if batch_df.isEmpty():
            return
        print(f"Batch {batch_id} - Processing {batch_df.count()} sliding windows")
        
        # Ghi Atlas
        batch_df.write.format("mongodb") \
            .mode("append") \
            .option("database", MONGO_DATABASE) \
            .option("collection", "live_ohlc_sliding") \
            .save()
            
        # Ghi Kafka bằng việc mang theo cấu hình bảo mật đầy đủ
        batch_df.selectExpr("to_json(struct(*)) AS value") \
            .write \
            .format("kafka") \
            .options(**kafka_opts) \
            .option("topic", KAFKA_LIVE_OHLC_TOPIC) \
            .save()

    # 1. Query OHLC
    ohlc_query = ohlc_sliding_df.writeStream \
        .foreachBatch(save_all) \
        .outputMode("update") \
        .trigger(processingTime='2 seconds') \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ohlc") \
        .start()

    # 2. Query Ticks
    ticks_query = parsed_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .options(**kafka_opts) \
        .option("topic", KAFKA_LIVE_TICKS_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ticks") \
        .start()

    # 3. Query Whale
    whale_alerts_df = parsed_df \
        .withColumn("total_usd", col("price") * col("volume")) \
        .filter(col("total_usd") >= WHALE_THRESHOLD_USD)

    whale_query = whale_alerts_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .options(**kafka_opts) \
        .option("topic", KAFKA_WHALE_ALERTS_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_whales") \
        .start()

    # 4. Query S3
    raw_storage_query = parsed_df \
        .writeStream \
        .format("parquet") \
        .partitionBy("symbol", "year", "month", "day") \
        .option("path", f"s3a://{S3_BUCKET}/raw_ticks") \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_raw_storage") \
        .start()

    spark.streams.awaitAnyTermination()

if __name__ == "__main__":
    process_stream()mination()

if __name__ == "__main__":
    process_stream()