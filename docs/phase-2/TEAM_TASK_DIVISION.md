# Phase 2: Team Task Division (Symbol-Based Full-Stack Approach)

Thay vì chia theo chức năng (Role), nhóm sẽ chia theo **Cặp tiền (Symbol)**. Mỗi thành viên sẽ chịu trách nhiệm phát triển **toàn bộ pipeline (End-to-End)** cho symbol được giao. Cách tiếp cận này giúp mọi thành viên đều được trải nghiệm và làm chủ toàn bộ các công nghệ trong hệ thống Big Data (NestJS, Kafka, Spark, MongoDB, Elasticsearch, React).

## Phân chia Symbol
- **Thành viên 1:** Phụ trách symbol **BTCUSDT** (Bitcoin)
- **Thành viên 2:** Phụ trách symbol **ETHUSDT** (Ethereum)
- **Thành viên 3:** Phụ trách symbol **SOLUSDT** (Solana)
- **Thành viên 4:** Phụ trách symbol **BNBUSDT** (Binance Coin)
- **Thành viên 5:** Phụ trách symbol **XRPUSDT** (Ripple)

## Quy trình phát triển (Áp dụng cho mỗi Thành viên)

Mỗi thành viên sẽ thực hiện 5 bước sau cho Symbol của mình:

### 1. Ingestion & Storage (Data Entry)
- [ ] Cấu hình NestJS để subcribe WebSocket Binance cho symbol được giao.
- [ ] Đẩy dữ liệu thô vào Kafka topic `binance-raw-ticks`.
- [ ] Thiết kế và triển khai việc lưu trữ dữ liệu thô từ Kafka vào **MongoDB** (Lớp lưu trữ lịch sử).

### 2. Real-time Processing (Spark Streaming)
- [ ] Viết Spark Structured Streaming job để tính toán OHLC (1m, 5m) cho symbol của mình.
- [ ] Cài đặt logic phát hiện "Cá mập" (Whale Alert) dựa trên đột biến volume của symbol đó.
- [ ] Xử lý Watermarking để đảm bảo dữ liệu đến trễ không làm sai lệch biểu đồ.

### 3. Analytics & Backtesting (Spark Batch)
- [ ] Viết Spark Batch job để truy vấn dữ liệu lịch sử của symbol từ MongoDB.
- [ ] Triển khai ít nhất 01 chiến thuật trading (ví dụ: Moving Average) để chạy Backtest trên symbol đó.
- [ ] Tính toán các chỉ số Profit/Loss, Drawdown bằng các hàm Pivot và Window Functions của Spark.

### 4. API & Backend Integration
- [ ] Viết API NestJS để truy vấn dữ liệu aggregated từ **Elasticsearch**.
- [ ] Cấu hình **Redis** để lưu trạng thái giá mới nhất và các cảnh báo gần đây của symbol.
- [ ] Xử lý Gateway WebSocket để đẩy dữ liệu real-time của symbol lên Dashboard.

### 5. Frontend & Visualization
- [ ] Phát triển màn hình Dashboard riêng (hoặc một Tab) cho symbol của mình.
- [ ] Tích hợp biểu đồ nến (Candlestick Chart) hiển thị dữ liệu từ Spark Streaming.
- [ ] Hiển thị danh sách Whale Alerts và kết quả Backtest trực quan.

---

## Phần chung (Shared Infrastructure)
*Tất cả thành viên cùng phối hợp xây dựng phần móng:*

1. **Hạ tầng chung:** Thiết lập Docker Compose chung (Kafka, Spark Cluster, MongoDB, ES) để mọi người cùng deploy code vào.
2. **Standardization:** Thống nhất định dạng JSON/Schema chung giữa các thành viên để các module có thể giao tiếp với nhau.
3. **CI/CD & Monitoring:** Cùng nhau quản lý việc log và check sức khỏe của các container.

---

## Lợi ích của cách chia này
- **Phát triển kỹ năng toàn diện:** Ai cũng được làm Spark (Streaming + Batch), NestJS, và React.
- **Tính độc lập:** Mỗi người có thể test pipeline của mình với symbol riêng mà không sợ ảnh hưởng quá nhiều đến logic của người khác.
- **Dễ đánh giá:** Kết quả hiển thị rõ ràng trên Dashboard theo từng symbol.

**Last Updated**: 2026-05-21 (Updated to Symbol-Based Approach)
