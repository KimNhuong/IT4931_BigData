from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr, year, month, dayofmonth
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType, BooleanType
import os
import time

# ----------------------------------------------------
# Xử lý KAFKA_CA_CERT từ Hugging Face Secret thành File vật lý
# ----------------------------------------------------
CA_CERT_TXT = os.getenv("KAFKA_CA_CERT", "").replace("\\n", "\n").replace("\r", "").strip()
CA_CERT_PATH = "/tmp/aiven_ca.pem"

if CA_CERT_TXT:
    # Ghi chuỗi cert từ secret ra một file tạm trong container
    with open(CA_CERT_PATH, "w") as f:
        f.write(CA_CERT_TXT)
    with open(CA_CERT_PATH, "r") as f:
        print(f"=== CONTENT OF {CA_CERT_PATH} ===\n{repr(f.read())}\n==================================")
    print(f"-> Đã khởi tạo thành công file chứng chỉ CA tại: {CA_CERT_PATH}")
else:
    print("⚠️ CẢNH BÁO: Không tìm thấy KAFKA_CA_CERT trong môi trường!")

# Configuration từ Hugging Face Secrets
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "")
KAFKA_SASL_USERNAME = os.getenv("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASSWORD = os.getenv("KAFKA_SASL_PASSWORD", "")
KAFKA_SASL_MECHANISM = os.getenv("KAFKA_SASL_MECHANISM", "SCRAM-SHA-256").upper()

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
CHECKPOINT_LOCATION = "/tmp/spark-checkpoints/ohlc_aggregator"

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
        .master("local[2]") \
        .config("spark.jars.packages", ",".join(packages)) \
        .config("spark.sql.shuffle.partitions", "2") \
        .config("spark.driver.memory", "1536m") \
        .config("spark.executor.memory", "512m") \
        .config("spark.python.worker.reuse", "true") \
        .config("spark.mongodb.write.connection.uri", MONGO_URI) \
        .config("spark.mongodb.write.database", MONGO_DATABASE) \
        .config("spark.hadoop.fs.s3a.access.key", AWS_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", AWS_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def get_kafka_options():
    options = {
        "kafka.bootstrap.servers": KAFKA_BROKER,
        "kafka.ssl.endpoint.identification.algorithm": "https"
    }
    
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
        else:
            # Nếu không có file CA, có thể thử bỏ qua verify nếu môi trường cho phép (không khuyến khích)
            # options["kafka.ssl.truststore.location"] = ...
            pass

    return options

def process_stream():
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")
    kafka_opts = get_kafka_options()

    # ----------------------------------------------------------------
    # Đọc dữ liệu thô từ Kafka
    # Dùng "latest" để chỉ xử lý data real-time, không load lại lịch sử
    # ----------------------------------------------------------------
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

    # ----------------------------------------------------------------
    # Aggregation OHLC với TUMBLING WINDOW (thay vì sliding window)
    # Sliding window (1m/2s) = 30 windows đồng thời → ngốn RAM
    # Tumbling window (1m) = 1 window tại một thời điểm → nhẹ hơn nhiều
    # ----------------------------------------------------------------
    watermarked_df = parsed_df.withWatermark("event_time", "10 seconds")

    ohlc_df = watermarked_df \
        .groupBy(col("symbol"), window(col("event_time"), "1 minute")) \
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
            col("window.end").alias("window_end"),
            col("open"), col("high"), col("low"), col("close"), col("volume"), col("vwap")
        )

    # ----------------------------------------------------------------
    # SINK 1: OHLC → Kafka topic (native sink, KHÔNG dùng foreachBatch)
    # append mode hoạt động tốt với tumbling window + watermark
    # ----------------------------------------------------------------
    ohlc_kafka_query = ohlc_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .outputMode("append") \
        .options(**kafka_opts) \
        .option("topic", KAFKA_LIVE_OHLC_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ohlc_kafka") \
        .trigger(processingTime='5 seconds') \
        .start()
    print("✅ [SINK 1] OHLC → Kafka: STARTED")

    # ----------------------------------------------------------------
    # SINK 3: Live ticks → Kafka (native sink)
    # ----------------------------------------------------------------
    ticks_query = parsed_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .options(**kafka_opts) \
        .option("topic", KAFKA_LIVE_TICKS_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ticks") \
        .start()
    print("✅ [SINK 3] Ticks → Kafka: STARTED")

    # ----------------------------------------------------------------
    # SINK 4: Whale alerts → Kafka (native sink)
    # ----------------------------------------------------------------
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
    print("✅ [SINK 4] Whale alerts → Kafka: STARTED")

    # ----------------------------------------------------------------
    # SINK 5: Raw ticks → S3 (Parquet, native sink)
    # ----------------------------------------------------------------
    raw_storage_query = parsed_df \
        .writeStream \
        .format("parquet") \
        .partitionBy("symbol", "year", "month", "day") \
        .option("path", f"s3a://{S3_BUCKET}/raw_ticks") \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_raw_storage") \
        .start()
    print("✅ [SINK 5] Raw ticks → S3: STARTED")

    print("\n🚀 Tất cả 5 streaming queries đã khởi động. Đang xử lý real-time...\n")
    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    process_stream()
