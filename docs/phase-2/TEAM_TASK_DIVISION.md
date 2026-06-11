# Phase 2: Team Task Division (Symbol-Based Full-Stack Approach)

Thay vì chia theo chức năng (Role), nhóm sẽ chia theo **Cặp tiền (Symbol)**. Mỗi thành viên sẽ chịu trách nhiệm phát triển **toàn bộ pipeline (End-to-End)** cho symbol được giao. Cách tiếp cận này giúp mọi thành viên đều được trải nghiệm và làm chủ toàn bộ các công nghệ trong hệ thống Big Data (NestJS, Kafka, Spark, MongoDB, Elasticsearch, React).

## Phân chia Symbol
- **Thành viên 1:** Phụ trách symbol **BTCUSDT** (Bitcoin) --> NhuongDK
- **Thành viên 2:** Phụ trách symbol **ETHUSDT** (Ethereum) --> AnhNQ
- **Thành viên 3:** Phụ trách symbol **SOLUSDT** (Solana) --> LoiT
- **Thành viên 4:** Phụ trách symbol **BNBUSDT** (Binance Coin) --> NhanNX
- **Thành viên 5:** Phụ trách symbol **XRPUSDT** (Ripple) --> DaiND

## Quy trình phát triển (Áp dụng cho mỗi Thành viên)

Mỗi thành viên sẽ thực hiện 5 bước sau cho Symbol của mình:

### 1. Ingestion & Storage (Data Entry)
- [ DONE ] Cấu hình NestJS để subcribe WebSocket Binance cho symbol được giao.
- [ DONE ] Đẩy dữ liệu thô vào Kafka topic `binance-raw-ticks`.
- [ DONE ] Thiết kế và triển khai việc lưu trữ dữ liệu thô từ Kafka vào **MongoDB** và **MinIO** (định dạng **Parquet** - thỏa mãn yêu cầu Lưu trữ phân tán).

### 2. Real-time Processing (Spark Streaming)
- [ DONE ] Viết Spark Structured Streaming job để tính toán OHLC (1m, 5m) cho symbol của mình.
- [ DONE ] Cài đặt logic phát hiện "Cá mập" (Whale Alert) dựa trên đột biến volume của symbol đó.
- [ 1/2 ] Xử lý **Watermarking** và **Checkpointing** để đảm bảo dữ liệu đến trễ và khả năng chịu lỗi.



### 3. Analytics & Backtesting (Spark Batch)
- [  ] Viết Spark Batch job để truy vấn dữ liệu lịch sử của symbol từ MinIO (định dạng Parquet) hoặc MongoDB.
- [ ] Thực hiện **Broadcast Join** với bảng metadata symbol để làm giàu dữ liệu trước khi tính toán.
- [ ] Triển khai chiến thuật trading (ví dụ: MA Crossover) sử dụng **Window Functions** và **Pivot** để tính PnL theo tháng.
- [ ] Tích hợp **Spark MLlib** (ví dụ: Linear Regression) để dự đoán xu hướng giá ngắn hạn.

### 4. API & Backend Integration
- [ DONE ] Viết API NestJS để truy vấn dữ liệu aggregated từ **spark**.
- [ ] Cấu hình **Redis** để lưu trạng thái giá mới nhất và các cảnh báo gần đây của symbol.
- [ DONE ] Xử lý Gateway WebSocket để đẩy dữ liệu real-time của symbol lên Dashboard.

### 5. Frontend & Visualization
- [ DONE ] Phát triển màn hình Dashboard riêng (hoặc một Tab) cho symbol của mình.
- [ DONE 1/2 ]  Tích hợp biểu đồ nến (Candlestick Chart) hiển thị dữ liệu từ Spark Streaming.
- [ Cái 3 DONE Là cái này DONE ] Hiển thị danh sách Whale Alerts và kết quả Backtest/ML Prediction trực quan.

---

## Phần chung (Shared Infrastructure)
*Tất cả thành viên cùng phối hợp xây dựng phần móng:*

1. **Hạ tầng chung:** Thiết lập Docker Compose chung (Kafka, Spark Cluster, MongoDB, ES, **MinIO**) để mọi người cùng deploy code vào.
2. **Standardization:** Thống nhất định dạng JSON/Schema và cấu trúc thư mục Parquet trên MinIO.
3. **CI/CD & Monitoring:** Cùng nhau quản lý việc log và check sức khỏe của các container.

---

## Lợi ích của cách chia này
- **Phát triển kỹ năng toàn diện:** Ai cũng được làm Spark (Streaming + Batch), NestJS, và React.
- **Tính độc lập:** Mỗi người có thể test pipeline của mình với symbol riêng mà không sợ ảnh hưởng quá nhiều đến logic của người khác.
- **Dễ đánh giá:** Kết quả hiển thị rõ ràng trên Dashboard theo từng symbol.

**Last Updated**: 2026-05-24 (Updated to Symbol-Based Approach)
