from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType
import os

# Configuration
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
KAFKA_TOPIC = "binance-raw-ticks"
CHECKPOINT_LOCATION = "/app/checkpoints/ohlc_aggregator"
OUTPUT_MODE = "append"

# Danh sách Coin cấu hình sẵn để tối ưu hiệu năng
TRACKED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
MONGO_DATABASE = "binance"

# MinIO / S3 Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "binance-data")

# Schema of the incoming Kafka messages
schema = StructType([
    StructField("symbol", StringType()),
    StructField("price", DoubleType()),
    StructField("volume", DoubleType()),
    StructField("timestamp", LongType()),
    StructField("high", DoubleType()),
    StructField("low", DoubleType()),
    StructField("open", DoubleType())
])

def create_spark_session():
    return SparkSession.builder \
        .appName("BinanceOHLCAggregator") \
        .config("spark.sql.shuffle.partitions", "2") \
        .config("spark.mongodb.write.connection.uri", MONGO_URI) \
        .config("spark.mongodb.write.database", MONGO_DATABASE) \
        .config("spark.sql.streaming.minBatchesToRetain", "10") \
        .config("spark.hadoop.fs.s3a.endpoint", MINIO_ENDPOINT) \
        .config("spark.hadoop.fs.s3a.access.key", MINIO_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", MINIO_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .config("spark.hadoop.fs.s3a.aws.credentials.provider", "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider") \
        .getOrCreate()

def process_stream():
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    # Read from Kafka
    raw_df = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .option("subscribe", KAFKA_TOPIC) \
        .option("startingOffsets", "latest") \
        .load()

    # Parse JSON and convert timestamp
    parsed_df = raw_df.selectExpr("CAST(value AS STRING)") \
        .select(from_json(col("value"), schema).alias("data")) \
        .select("data.*") \
        .withColumn("event_time", (col("timestamp") / 1000).cast("timestamp"))

    # Add Watermark (10 seconds delay tolerance)
    windowed_df = parsed_df \
        .withWatermark("event_time", "10 seconds")

    # Aggregate OHLC (1 minute windows)
    ohlc_df = windowed_df \
        .groupBy(
            col("symbol"),
            window(col("event_time"), "1 minute")
        ) \
        .agg(
            first("price").alias("open"),
            max("price").alias("high"),
            min("price").alias("low"),
            last("price").alias("close"),
            sum("volume").alias("volume")
        ) \
        .select(
            col("symbol"),
            col("window.start").alias("timestamp"),
            col("open"),
            col("high"),
            col("low"),
            col("close"),
            col("volume")
        )

    # Consolidated sink using foreachBatch
    def save_to_sinks(batch_df, batch_id):
        print(f"-------------------------------------------")
        print(f"Batch: {batch_id}")
        print(f"-------------------------------------------")
        
        # Chỉ gọi duy nhất lệnh .show() để kiểm tra dữ liệu trên console.
        # Nếu batch rỗng, Spark sẽ in bảng trống và chạy tiếp cực nhanh mà không bị nghẽn mạng.
        batch_df.show(5)
        
        # --- SINK 1: LƯU VÀO MONGODB (Xử lý Bulk - Lưu toàn bộ Coin vào 1 collection chung 'live_ohlc') ---
        try:
            print(f"--> Saving all symbols to MongoDB simultaneously...")
            batch_df.write.format("mongodb") \
                .mode("append") \
                .option("database", MONGO_DATABASE) \
                .option("collection", "live_ohlc") \
                .save()
            print("--> MongoDB Bulk Success! 🎉")
        except Exception as mongo_err:
            print(f"--> [ERROR] MongoDB Bulk failed: {str(mongo_err)}")
        
        # --- SINK 2: BẮN VÀO KAFKA (Xử lý Bulk 1 lần duy nhất cho NestJS) ---
        try:
            print(f"--> Pushing all symbols to Kafka topic: binance-live-ohlc")
            kafka_payload_df = batch_df.selectExpr("CAST(timestamp AS STRING) AS key", "to_json(struct(*)) AS value")
            kafka_payload_df.write \
                .format("kafka") \
                .option("kafka.bootstrap.servers", KAFKA_BROKER) \
                .option("topic", "binance-live-ohlc") \
                .save()
            print("--> Kafka Bulk Success!")
        except Exception as kafka_err:
            print(f"--> [ERROR] Kafka Bulk failed: {str(kafka_err)}")

        # --- SINK 3: LƯU VÀO MINIO DATA LAKE (Sử dụng Partition động của Spark) ---
        try:
            print(f"--> Saving all symbols to MinIO Data Lake via partitionBy...")
            # Lệnh .partitionBy("symbol") sẽ tự động băm nhỏ dữ liệu ra các thư mục coin trên MinIO
            batch_df.write \
                .mode("append") \
                .format("parquet") \
                .partitionBy("symbol") \
                .save(f"s3a://{MINIO_BUCKET}/ohlc/")
            print("--> MinIO Bulk Success!")
        except Exception as minio_err:
            print(f"--> [WARN] MinIO Bulk failed: {str(minio_err)}")

        print(f"Batch {batch_id} processed completely in parallel.")
        print(f"-------------------------------------------")

    query = ohlc_df.writeStream \
        .foreachBatch(save_to_sinks) \
        .outputMode("append") \
        .trigger(processingTime='10 seconds') \
        .option("checkpointLocation", CHECKPOINT_LOCATION) \
        .start()

    query.awaitTermination()

if __name__ == "__main__":
    process_stream()