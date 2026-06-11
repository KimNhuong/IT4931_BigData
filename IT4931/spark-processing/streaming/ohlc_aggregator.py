from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType, BooleanType
import os

# Configuration
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
KAFKA_RAW_TOPIC = "binance-raw-ticks"
KAFKA_LIVE_TICKS_TOPIC = "binance-live-ticks"
KAFKA_LIVE_OHLC_TOPIC = "binance-live-ohlc"
CHECKPOINT_LOCATION = "/app/checkpoints/ohlc_aggregator"

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
MONGO_DATABASE = "binance"

# MinIO / S3 Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "binance-data")

# Schema of the incoming Kafka messages (aggTrade)
schema = StructType([
    StructField("symbol", StringType()),
    StructField("price", DoubleType()),
    StructField("volume", DoubleType()),
    StructField("timestamp", LongType()),
    StructField("tradeId", LongType()),
    StructField("isMaker", BooleanType())
])

def create_spark_session():
    return SparkSession.builder \
        .appName("BinanceRealTimeProcessor") \
        .config("spark.sql.shuffle.partitions", "2") \
        .config("spark.mongodb.write.connection.uri", MONGO_URI) \
        .config("spark.mongodb.write.database", MONGO_DATABASE) \
        .config("spark.hadoop.fs.s3a.endpoint", MINIO_ENDPOINT) \
        .config("spark.hadoop.fs.s3a.access.key", MINIO_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", MINIO_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def process_stream():
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    # Read from Kafka
    raw_df = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .option("subscribe", KAFKA_RAW_TOPIC) \
        .option("startingOffsets", "latest") \
        .load()

    # Parse JSON and convert timestamp
    parsed_df = raw_df.selectExpr("CAST(value AS STRING)") \
        .select(from_json(col("value"), schema).alias("data")) \
        .select("data.*") \
        .withColumn("event_time", (col("timestamp") / 1000).cast("timestamp"))

    # Watermark (5 seconds)
    watermarked_df = parsed_df \
        .withWatermark("event_time", "5 seconds")

    # 1. Sliding Window OHLC (1 min window, 2 sec slide) + VWAP
    ohlc_sliding_df = watermarked_df \
        .groupBy(
            col("symbol"),
            window(col("event_time"), "1 minute", "2 seconds")
        ) \
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
            col("open"),
            col("high"),
            col("low"),
            col("close"),
            col("volume"),
            col("vwap")
        )

    def save_all(batch_df, batch_id):
        if batch_df.isEmpty():
            return

        print(f"Batch {batch_id} - Processing {batch_df.count()} sliding windows")
        
        # Save to MongoDB
        batch_df.write.format("mongodb") \
            .mode("append") \
            .option("collection", "live_ohlc_sliding") \
            .save()
            
        # Push to Kafka (Live OHLC)
        batch_df.selectExpr("to_json(struct(*)) AS value") \
            .write \
            .format("kafka") \
            .option("kafka.bootstrap.servers", KAFKA_BROKER) \
            .option("topic", KAFKA_LIVE_OHLC_TOPIC) \
            .save()

    # Query for Sliding OHLC
    ohlc_query = ohlc_sliding_df.writeStream \
        .foreachBatch(save_all) \
        .outputMode("update") \
        .trigger(processingTime='2 seconds') \
        .checkpointLocation(f"{CHECKPOINT_LOCATION}_ohlc") \
        .start()

    # 2. Raw Ticks for Frontend (Flickering Price)
    # We just pass them through to a "live-ticks" topic
    ticks_query = parsed_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .option("topic", KAFKA_LIVE_TICKS_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ticks") \
        .start()

    spark.streams.awaitAnyTermination()

if __name__ == "__main__":
    process_stream()

if __name__ == "__main__":
    process_stream()