from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr
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
        if batch_df.isEmpty():
            print("Batch is empty.")
            return
            
        batch_df.show()
        
        try:
            print(f"Batch {batch_id}: Processing via static TRACKED_SYMBOLS list...")
            
            for symbol_name in TRACKED_SYMBOLS:
                symbol_df = batch_df.filter(col("symbol") == symbol_name)
                
                if not symbol_df.rdd.isEmpty(): 
                    # 1. LƯU VÀO MONGODB
                    dynamic_collection_name = f"OHLC_{symbol_name}"
                    print(f"--> Saving to MongoDB collection: {dynamic_collection_name}")
                    symbol_df.write.format("mongodb") \
                        .mode("append") \
                        .option("database", MONGO_DATABASE) \
                        .option("collection", dynamic_collection_name) \
                        .save()
                    
                    # 2. BẮN VÀO KAFKA CHO NESTJS / FRONTEND
                    print(f"--> Pushing to Kafka topic: binance-live-ohlc")
                    kafka_payload_df = symbol_df.selectExpr("CAST(timestamp AS STRING) AS key", "to_json(struct(*)) AS value")
                    kafka_payload_df.write \
                        .format("kafka") \
                        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
                        .option("topic", "binance-live-ohlc") \
                        .save()

                    # 3. LƯU VÀO MINIO (DATA LAKE PARQUET)
                    print(f"--> Saving to MinIO Data Lake for: {symbol_name}")
                    symbol_df.write \
                        .mode("append") \
                        .format("parquet") \
                        .partitionBy("symbol") \
                        .save(f"s3a://{MINIO_BUCKET}/ohlc/")
                    
            print(f"Batch {batch_id} successfully processed (Mongo + Kafka + MinIO).")

        except Exception as e:
            print(f"Error saving batch {batch_id} to destinations: {str(e)}")

    # Start the streaming query with a single sink
    query = ohlc_df.writeStream \
        .foreachBatch(save_to_sinks) \
        .outputMode("append") \
        .trigger(processingTime='10 seconds') \
        .option("checkpointLocation", CHECKPOINT_LOCATION) \
        .start()

    query.awaitTermination()

if __name__ == "__main__":
    process_stream()