from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType
import os

# Configuration
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
KAFKA_TOPIC = "binance-raw-ticks"
CHECKPOINT_LOCATION = "/app/checkpoints/ohlc_aggregator"
OUTPUT_MODE = "append"

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

    # Write to Console (for debugging)
    query_console = ohlc_df.writeStream \
        .outputMode("update") \
        .format("console") \
        .start()

    # In a real scenario, we would write to Elasticsearch or MongoDB here
    # Since we want to use 'Intermediate Spark' features, we could use foreachBatch
    def save_to_sinks(batch_df, batch_id):
        # 1. Save to Elasticsearch (requires elasticsearch-spark connector)
        # batch_df.write.format("org.elasticsearch.spark.sql").mode("append").save("crypto-ohlc")
        
        # 2. Save to MongoDB
        # batch_df.write.format("mongodb").mode("append").option("collection", "OHLC").save()
        
        # 3. Save to MinIO (Parquet) - Distributed Storage requirement
        batch_df.write.mode("append").parquet("s3a://binance-data/ohlc/")
        
        print(f"Batch {batch_id} processed and saved.")

    # query_sinks = ohlc_df.writeStream \
    #     .foreachBatch(save_to_sinks) \
    #     .option("checkpointLocation", CHECKPOINT_LOCATION) \
    #     .start()

    query_console.awaitTermination()

if __name__ == "__main__":
    process_stream()
