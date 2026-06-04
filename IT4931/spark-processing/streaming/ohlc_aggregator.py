from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType
import os

# Configuration
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
KAFKA_TOPIC = "binance-raw-ticks"
CHECKPOINT_LOCATION = "/app/checkpoints/ohlc_aggregator"
OUTPUT_MODE = "append"

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
MONGO_DATABASE = "binance"
MONGO_COLLECTION = "ohlc_data"

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
        .config("spark.mongodb.write.collection", MONGO_COLLECTION) \
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

    # Whale Alert Detection (Example: Volume > 100 on 1m window)
    # In reality, this threshold should be symbol-specific
    whale_alerts = ohlc_df.filter(col("volume") > 100) \
        .withColumn("alert_type", expr("'WHALE_VOLUME'"))

    # Consolidated sink using foreachBatch
    def save_to_sinks(batch_df, batch_id):
        # 1. Print to console for debugging (Replacing console sink)
        print(f"-------------------------------------------")
        print(f"Batch: {batch_id}")
        print(f"-------------------------------------------")
        if batch_df.isEmpty():
            print("Batch is empty.")
            return
            
        batch_df.show()
        
        # 2. Save to MongoDB
        try:
            print(f"Batch {batch_id}: Saving to MongoDB...")
            batch_df.write.format("mongodb") \
                .mode("append") \
                .option("database", MONGO_DATABASE) \
                .option("collection", MONGO_COLLECTION) \
                .save()
            print(f"Batch {batch_id} processed and saved.")
        except Exception as e:
            print(f"Error saving batch {batch_id} to MongoDB: {str(e)}")

        # 3. Save to MinIO (Optional placeholder)
        # batch_df.write.mode("append").parquet("s3a://binance-data/ohlc/")

    # Start the streaming query with a single sink
    query = ohlc_df.writeStream \
        .foreachBatch(save_to_sinks) \
        .outputMode("append") \
        .option("checkpointLocation", CHECKPOINT_LOCATION) \
        .start()

    query.awaitTermination()

if __name__ == "__main__":
    process_stream()
