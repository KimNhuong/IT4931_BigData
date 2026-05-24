from pyspark.sql import SparkSession
from pyspark.sql.window import Window
from pyspark.sql.functions import col, avg, lag, when, sum as spark_sum, month, year, broadcast
import os

# Configuration
MINIO_URL = os.getenv("MINIO_URL", "s3a://binance-data/ohlc/")
SYMBOL_METADATA_PATH = "/app/data/symbol_metadata.csv" # Local file for broadcast join demo

def create_spark_session():
    return SparkSession.builder \
        .appName("BinanceBacktestEngine") \
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000") \
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin") \
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin") \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def run_backtest(strategy_name="MA_Crossover"):
    spark = create_spark_session()
    
    # 1. Read Historical Data (Intermediate: Parquet format)
    # df = spark.read.parquet(MINIO_URL)
    
    # For demo purposes, if MinIO is empty, we might use mock data or read from MongoDB
    # historical_df = spark.read.format("mongodb").load()
    
    # Mock data for demonstration of Window Functions and Pivot
    from pyspark.sql import Row
    from datetime import datetime, timedelta
    
    data = []
    base_time = datetime(2024, 1, 1)
    for i in range(100):
        data.append(Row(symbol="BTCUSDT", timestamp=base_time + timedelta(minutes=i), close=40000 + i*10 + (i%5)*100))
        data.append(Row(symbol="ETHUSDT", timestamp=base_time + timedelta(minutes=i), close=2200 + i*2 + (i%3)*20))
    
    df = spark.createDataFrame(data)

    # 2. Window Functions (Intermediate Spark I.1)
    windowSpecShort = Window.partitionBy("symbol").orderBy("timestamp").rowsBetween(-5, 0)
    windowSpecLong = Window.partitionBy("symbol").orderBy("timestamp").rowsBetween(-20, 0)

    df_signals = df.withColumn("MA5", avg("close").over(windowSpecShort)) \
                   .withColumn("MA20", avg("close").over(windowSpecLong))

    # Signal Logic: Buy when MA5 > MA20
    df_signals = df_signals.withColumn("signal", when(col("MA5") > col("MA20"), 1).otherwise(0)) \
                           .withColumn("prev_signal", lag("signal", 1).over(Window.partitionBy("symbol").orderBy("timestamp")))

    # 3. Broadcast Join (Intermediate Spark I.3)
    # Imagine we have a small metadata table
    metadata_data = [
        Row(symbol="BTCUSDT", name="Bitcoin", category="L1"),
        Row(symbol="ETHUSDT", name="Ethereum", category="L1"),
        Row(symbol="SOLUSDT", name="Solana", category="L1")
    ]
    metadata_df = spark.createDataFrame(metadata_data)
    
    # Use broadcast join for the small metadata table
    df_enriched = df_signals.join(broadcast(metadata_df), "symbol", "left")

    # 4. Calculate PnL (Simplified)
    df_pnl = df_enriched.withColumn("price_change", col("close") - lag("close", 1).over(Window.partitionBy("symbol").orderBy("timestamp"))) \
                        .withColumn("daily_pnl", col("prev_signal") * col("price_change"))

    # 5. Pivot (Intermediate Spark I.1)
    # Aggregating performance by Month and Symbol
    df_pnl = df_pnl.withColumn("month", month("timestamp")) \
                   .withColumn("year", year("timestamp"))

    performance_report = df_pnl.groupBy("symbol").pivot("month").agg(spark_sum("daily_pnl"))

    print("--- Backtest Performance Report ---")
    performance_report.show()

    # 6. Advanced Analytics: Spark MLlib (Intermediate Spark I.6)
    from pyspark.ml.feature import VectorAssembler
    from pyspark.ml.regression import LinearRegression

    print("--- Running Price Prediction Model (MLlib) ---")
    # Prepare features: using MA5 and MA20 to predict next close
    ml_df = df_signals.select("MA5", "MA20", "close").dropna()
    assembler = VectorAssembler(inputCols=["MA5", "MA20"], outputCol="features")
    ml_data = assembler.transform(ml_df).select("features", col("close").alias("label"))

    lr = LinearRegression(maxIter=10, regParam=0.3, elasticNetParam=0.8)
    lr_model = lr.fit(ml_data)

    print(f"Coefficients: {lr_model.coefficients} Intercept: {lr_model.intercept}")
    training_summary = lr_model.summary
    print(f"RMSE: {training_summary.rootMeanSquaredError}")

    # 7. Save results back to MinIO/MongoDB
    # performance_report.write.format("mongodb").mode("overwrite").save()

if __name__ == "__main__":
    run_backtest()
