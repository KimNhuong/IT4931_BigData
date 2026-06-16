from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, LongType
from pyspark.sql.functions import col, to_date
import os
import sys

# AWS S3 Configuration 
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "")
S3_BUCKET = os.getenv("S3_BUCKET", "binance-data-it4931")

def create_spark_session():
    return SparkSession.builder \
        .appName("HistoricalCSVLoader") \
        .config("spark.hadoop.fs.s3a.access.key", AWS_ACCESS_KEY) \
        .config("spark.hadoop.fs.s3a.secret.key", AWS_SECRET_KEY) \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .config("spark.hadoop.fs.s3a.committer.name", "magic") \
        .config("spark.hadoop.fs.s3a.committer.magic.enabled", "true") \
        .config("spark.sql.sources.commitProtocolClass", "org.apache.spark.internal.io.HadoopMapReduceCommitProtocol") \
        .config("spark.hadoop.mapreduce.outputcommitter.class", "org.apache.hadoop.fs.s3a.commit.magic.MagicS3GuardCommitter") \
        .getOrCreate()

# CHÚ Ý: Đã thêm tham số 'spark' vào đầu hàm để nhận Session truyền từ ngoài vào
def ingest_historical_data(spark, csv_path, symbol):
    # Kiểm tra file/thư mục tồn tại
    if not os.path.exists(csv_path):
        print(f"Error: CSV path not found at {csv_path}")
        sys.exit(1)

    print(f"--- Loading Historical Data for {symbol} ---")
    
    # 1. Định nghĩa Schema cho Binance aggTrade CSV
    schema = StructType([
        StructField("agg_trade_id", LongType(), True),
        StructField("price", DoubleType(), True),
        StructField("volume", DoubleType(), True),
        StructField("first_trade_id", LongType(), True),
        StructField("last_trade_id", LongType(), True),
        StructField("timestamp", LongType(), True),
        StructField("is_maker", StringType(), True),
        StructField("is_best_match", StringType(), True)
    ])

    # Đọc dữ liệu từ đường dẫn CSV
    df = spark.read.csv(csv_path, schema=schema, header=False)
    
    # 2. Làm sạch và biến đổi dữ liệu (ETL)
    print("Cleaning and transforming data...")
    cleaned_df = df.dropna(subset=["price", "volume", "timestamp"])
    
    # Thêm cột symbol dựa trên tham số truyền vào
    final_df = cleaned_df.withColumn("symbol", col("symbol")) if "symbol" in df.columns else cleaned_df.withColumn("symbol", col("symbol") if False else col("price")*0 + 1).withColumn("symbol", col("symbol").cast("string"))
    # Trick xử lý an toàn để gán cứng giá trị symbol chuỗi
    import pyspark.sql.functions as F
    final_df = cleaned_df.withColumn("symbol", F.lit(symbol))
                   
    # Chuyển đổi timestamp từ mili-giây sang Date để Partition
    final_df = final_df.withColumn("event_time", (col("timestamp") / 1000).cast("timestamp")) \
                       .withColumn("date", to_date("event_time"))

    # Chỉ lấy các cột cần thiết để tối ưu dung lượng Parquet
    final_df = final_df.select("symbol", "price", "volume", "timestamp", "event_time", "date")
    
    final_df.show(5)

    # 3. Ghi dữ liệu vào MinIO định dạng Parquet kết hợp Partitioning
    output_path = f"s3a://{S3_BUCKET}/historical_ticks/"
    print(f"Writing data to AWS S3 at {output_path} partitioned by symbol and date...")
    
    final_df.write \
        .mode("append") \
        .partitionBy("symbol", "date") \
        .parquet(output_path)

    print("--- Ingestion Complete ---")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: spark-submit load_csv_to_minio.py <path_to_csv> <symbol>")
        sys.exit(1)
        
    input_csv = sys.argv[1]
    input_symbol = sys.argv[2]
    
    # Khởi tạo Spark Session một lần duy nhất tại đây
    spark = create_spark_session()
    
    try:
        ingest_historical_data(spark, input_csv, input_symbol)
    finally:
        # Luôn luôn đóng Spark Session khi kết thúc chương trình thành công hoặc thất bại
        spark.stop()