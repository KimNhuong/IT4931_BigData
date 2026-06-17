Các bước script này thực hiện:
   1. Định nghĩa Schema (Extract): Áp dụng đúng cấu trúc các cột của file aggTrades tải từ Binance (bao gồm giá, khối lượng, ID giao dịch,
      timestamp dạng millisecond).
   2. Dọn dẹp và Transform:
      - Loại bỏ các dòng bị lỗi null giá trị cốt lõi.
      - Thêm cột symbol (được truyền vào từ tham số dòng lệnh).
      - Biến đổi timestamp (long) thành kiểu timestamp và trích xuất ra một cột date (YYYY-MM-DD) chuẩn.
   3. Lưu Parquet + Partitioning (Load):
      - Ghi dữ liệu vào MinIO bucket binance-data với đường dẫn historical_ticks/.
      - Sử dụng .partitionBy("symbol", "date"). Nghĩa là cấu trúc thư mục trên MinIO sau khi chạy sẽ có dạng:
        s3a://binance-data/historical_ticks/symbol=BTCUSDT/date=2026-06-11/part-xxxx.parquet. Điều này giúp đáp ứng tiêu chí Tối ưu hiệu năng
   1. Tải file CSV của bạn (ví dụ BTCUSDT-aggTrades.csv) và copy/chuyển nó vào thư mục IT4931/spark-processing/batch/ (hoặc tạo thêm thư mục
      data trong đó). Vì ổ đĩa đã được mount nên container Spark sẽ tự động nhìn thấy.
   2. Chạy lệnh sau để submit job vào Spark cluster:

   1 docker exec -it spark-master spark-submit \
   2   --master local[*] \
   3   --packages org.apache.hadoop:hadoop-aws:3.3.4 \
   4   /app/batch/load_csv_to_minio.py \
   5   /app/batch/BTCUSDT-aggTrades.csv \
   6   BTCUSDT
  (Hãy thay /app/batch/BTCUSDT-aggTrades.csv bằng tên file thực tế của bạn).