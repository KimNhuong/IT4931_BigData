from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, first, last, max, min, sum, expr, year, month, dayofmonth
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType, BooleanType
import os

# Configuration
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:29092")
KAFKA_SASL_USERNAME = os.getenv("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASSWORD = os.getenv("KAFKA_SASL_PASSWORD", "")
KAFKA_SASL_MECHANISM = os.getenv("KAFKA_SASL_MECHANISM", "PLAIN")
KAFKA_RAW_TOPIC = "binance-raw-ticks"
KAFKA_LIVE_TICKS_TOPIC = "binance-live-ticks"
KAFKA_LIVE_OHLC_TOPIC = "binance-live-ohlc"
KAFKA_WHALE_ALERTS_TOPIC = "binance-whale-alerts"

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
MONGO_DATABASE = "binance"

# Whale Detection Threshold
WHALE_THRESHOLD_USD = 100000  # 100k USD

# AWS S3 Configuration
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "")
S3_BUCKET = os.getenv("S3_BUCKET", "binance-data-it4931")

# Spark Checkpoints Configuration (S3)
CHECKPOINT_LOCATION = f"s3a://{S3_BUCKET}/checkpoints/ohlc_aggregator"

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
        .config("spark.hadoop.fs.s3a.access.key", AWS_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", AWS_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def get_kafka_options():
    options = {"kafka.bootstrap.servers": KAFKA_BROKER}
    if KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD:
        options["kafka.security.protocol"] = "SASL_SSL"
        options["kafka.sasl.mechanism"] = KAFKA_SASL_MECHANISM
        if KAFKA_SASL_MECHANISM.upper() == "PLAIN":
            options["kafka.sasl.jaas.config"] = f'org.apache.kafka.common.security.plain.PlainLoginModule required username="{KAFKA_SASL_USERNAME}" password="{KAFKA_SASL_PASSWORD}";'
        else:
            options["kafka.sasl.jaas.config"] = f'org.apache.kafka.common.security.scram.ScramLoginModule required username="{KAFKA_SASL_USERNAME}" password="{KAFKA_SASL_PASSWORD}";'
    return options

def process_stream():
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")
    kafka_opts = get_kafka_options()

    # Read from Kafka
    raw_df = spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .options(**kafka_opts) \
        .option("subscribe", KAFKA_RAW_TOPIC) \
        .option("startingOffsets", "latest") \
        .load()

    # Parse JSON and convert timestamp
    parsed_df = raw_df.selectExpr("CAST(value AS STRING)") \
        .select(from_json(col("value"), schema).alias("data")) \
        .select("data.*") \
        .withColumn("event_time", (col("timestamp") / 1000).cast("timestamp")) \
        .withColumn("year", year(col("event_time"))) \
        .withColumn("month", month(col("event_time"))) \
        .withColumn("day", dayofmonth(col("event_time")))

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
            .options(**kafka_opts) \
            .option("topic", KAFKA_LIVE_OHLC_TOPIC) \
            .save()

    # Query for Sliding OHLC
    ohlc_query = ohlc_sliding_df.writeStream \
        .foreachBatch(save_all) \
        .outputMode("update") \
        .trigger(processingTime='2 seconds') \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ohlc") \
        .start()

    # 2. Raw Ticks for Frontend (Flickering Price)
    ticks_query = parsed_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .options(**kafka_opts) \
        .option("topic", KAFKA_LIVE_TICKS_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_ticks") \
        .start()

    # 3. Whale Alerts Detection
    whale_alerts_df = parsed_df \
        .withColumn("total_usd", col("price") * col("volume")) \
        .filter(col("total_usd") >= WHALE_THRESHOLD_USD)

    whale_query = whale_alerts_df \
        .selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BROKER) \
        .options(**kafka_opts) \
        .option("topic", KAFKA_WHALE_ALERTS_TOPIC) \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_whales") \
        .start()

    # 4. Raw Ticks Storage to MinIO (Cold Storage)
    raw_storage_query = parsed_df \
        .writeStream \
        .format("parquet") \
        .partitionBy("symbol", "year", "month", "day") \
        .option("path", f"s3a://{S3_BUCKET}/raw_ticks") \
        .option("checkpointLocation", f"{CHECKPOINT_LOCATION}_raw_storage") \
        .start()

    spark.streams.awaitAnyTermination()

if __name__ == "__main__":
    process_stream()
