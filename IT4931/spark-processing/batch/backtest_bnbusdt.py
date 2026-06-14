from pyspark.sql import SparkSession
from pyspark.sql.window import Window
from pyspark.sql.functions import col, avg, lag, when, sum as spark_sum, month, year, broadcast
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import LinearRegression
from pyspark.sql import Row
import os

# Cấu hình đường dẫn
MINIO_URL = os.getenv("MINIO_URL", "s3a://binance-data/ohlc/")

def create_spark_session():
    # Khởi tạo Spark Session với cấu hình kết nối MinIO S3
    return SparkSession.builder \
        .appName("BinanceBacktestEngine_BNBUSDT") \
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000") \
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin") \
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin") \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .getOrCreate()

def run_backtest_bnb():
    spark = create_spark_session()
    TARGET_SYMBOL = "BNBUSDT"
    
    print(f"--- 1. Truy vấn dữ liệu lịch sử cho {TARGET_SYMBOL} từ MinIO ---")
    # Đọc dữ liệu định dạng Parquet từ MinIO và filter riêng cho BNBUSDT
    # df = spark.read.parquet(MINIO_URL).filter(col("symbol") == TARGET_SYMBOL)
    
    # (Dữ liệu giả lập để minh họa nếu chưa có sẵn file Parquet thực tế)
    from datetime import datetime, timedelta
    data = []
    base_time = datetime(2024, 1, 1)
    for i in range(200):
        # Tạo dữ liệu giả lập với biến động giá cho BNBUSDT
        data.append(Row(symbol=TARGET_SYMBOL, timestamp=base_time + timedelta(days=i), close=300 + i*0.5 + (i%5)*2))
    df = spark.createDataFrame(data)

    print(f"--- 2. Thực hiện Broadcast Join với Metadata ---")
    # Tạo bảng metadata nhỏ gọn chứa thông tin chi tiết của các coin
    metadata_data = [
        Row(symbol="BNBUSDT", name="Binance Coin", category="L1/Exchange"),
        Row(symbol="BTCUSDT", name="Bitcoin", category="L1"),
        Row(symbol="ETHUSDT", name="Ethereum", category="L1")
    ]
    metadata_df = spark.createDataFrame(metadata_data)
    
    # Dùng broadcast() để tối ưu hóa join do bảng metadata rất nhỏ
    df_enriched = df.join(broadcast(metadata_df), "symbol", "left")

    print(f"--- 3. Tính toán Window Functions và Chiến lược MA Crossover ---")
    # Định nghĩa cửa sổ trượt: MA5 (5 ngày) và MA20 (20 ngày)
    windowSpecShort = Window.partitionBy("symbol").orderBy("timestamp").rowsBetween(-5, 0)
    windowSpecLong = Window.partitionBy("symbol").orderBy("timestamp").rowsBetween(-20, 0)

    # Tính đường trung bình động (Moving Average)
    df_signals = df_enriched.withColumn("MA5", avg("close").over(windowSpecShort)) \
                            .withColumn("MA20", avg("close").over(windowSpecLong))

    # Logic chiến lược: Mua (1) khi MA5 cắt lên MA20, ngược lại Bán/Đứng ngoài (0)
    df_signals = df_signals.withColumn("signal", when(col("MA5") > col("MA20"), 1).otherwise(0)) \
                           .withColumn("prev_signal", lag("signal", 1).over(Window.partitionBy("symbol").orderBy("timestamp")))

    # Tính toán chênh lệch giá để ra Lời/Lỗ (PnL) hàng ngày
    df_pnl = df_signals.withColumn("price_change", col("close") - lag("close", 1).over(Window.partitionBy("symbol").orderBy("timestamp"))) \
                       .withColumn("daily_pnl", col("prev_signal") * col("price_change"))

    print(f"--- 4. Sử dụng Pivot tính tổng PnL theo tháng ---")
    # Trích xuất tháng và năm từ cột timestamp
    df_pnl = df_pnl.withColumn("month", month("timestamp")) \
                   .withColumn("year", year("timestamp"))

    # Group by symbol, pivot theo tháng và tính tổng PnL
    performance_report = df_pnl.groupBy("symbol", "year").pivot("month").agg(spark_sum("daily_pnl"))
    performance_report.show()

    print("--- 5. Tích hợp Spark MLlib: Dự đoán xu hướng giá ngắn hạn ---")
    # Sử dụng Linear Regression từ pyspark.ml
    # Lấy các cột làm features (MA5, MA20) để dự đoán nhãn (close)
    ml_df = df_signals.select("MA5", "MA20", "close").dropna()
    
    # Đóng gói features thành vector
    assembler = VectorAssembler(inputCols=["MA5", "MA20"], outputCol="features")
    ml_data = assembler.transform(ml_df).select("features", col("close").alias("label"))

    # Khởi tạo và huấn luyện mô hình Linear Regression
    lr = LinearRegression(maxIter=10, regParam=0.3, elasticNetParam=0.8)
    lr_model = lr.fit(ml_data)

    print(f"Trọng số (Coefficients): {lr_model.coefficients}")
    print(f"Điểm chặn (Intercept): {lr_model.intercept}")
    print(f"Độ lỗi (RMSE): {lr_model.summary.rootMeanSquaredError}")

    # (Tùy chọn) Ghi kết quả ngược lại Kafka topic 'binance-backtest-results' hoặc MongoDB
    # performance_report.write.format("kafka").option("topic", "binance-backtest-results").save()

if __name__ == "__main__":
    run_backtest_bnb()