# Phase 2: Team Task Division V2 (High-Frequency & Sliding Window Approach)

*Cập nhật theo kiến trúc "Tick-level Processing" để đáp ứng đúng bản chất Real-time Streaming của Big Data.*

Thay vì chia theo chức năng (Role), nhóm sẽ chia theo **Cặp tiền (Symbol)**. Mỗi thành viên sẽ chịu trách nhiệm phát triển **toàn bộ pipeline (End-to-End)** cho symbol được giao. Cách tiếp cận này giúp mọi thành viên đều được trải nghiệm và làm chủ toàn bộ các công nghệ trong hệ thống Big Data (NestJS, Kafka, Spark, MongoDB, Elasticsearch, React).

## Phân chia Symbol
- **Thành viên 1:** Phụ trách symbol **BTCUSDT** (Bitcoin) --> NhuongDK
- **Thành viên 2:** Phụ trách symbol **ETHUSDT** (Ethereum) --> AnhNQ
- **Thành viên 3:** Phụ trách symbol **SOLUSDT** (Solana) --> LoiT
- **Thành viên 4:** Phụ trách symbol **BNBUSDT** (Binance Coin) --> NhanNX
- **Thành viên 5:** Phụ trách symbol **XRPUSDT** (Ripple) --> DaiND

## Quy trình phát triển (Áp dụng cho mỗi Thành viên)

Mỗi thành viên sẽ thực hiện 5 bước sau cho Symbol của mình:

### 1. High-Frequency Ingestion & Storage (Data Entry)
- [ ] Thay đổi Ingestor (NestJS): Chuyển từ subscribe luồng `@ticker` (đã tổng hợp) sang luồng `@aggTrade` (từng giao dịch/tick riêng lẻ) cho symbol được giao.
- [ ] **Data Hydration (Seeding):** Triển khai service gọi Binance REST API (`/api/v3/klines`) để nạp 500-1000 nến quá khứ (1m) vào MongoDB. Điều này giúp Dashboard có dữ liệu vẽ chart ngay lập tức mà không cần đợi Spark tích lũy.
- [ ] Bắn **raw ticks** với volume và price từng giao dịch vào Kafka topic `binance-raw-ticks`.
- [ ] Thiết kế và triển khai việc lưu trữ dữ liệu tick thô từ Kafka vào **MongoDB** và **MinIO** (định dạng **Parquet** - thỏa mãn yêu cầu Lưu trữ phân tán).

### 2. Real-time Processing (Spark Streaming - Sliding Window)
- [ ] **Luồng 1 (High Frequency):** Viết Spark Structured Streaming job áp dụng **Sliding Window** (ví dụ: cửa sổ 1 phút, trượt mỗi 1-2 giây) để tính toán OHLC liên tục cho symbol của mình.
- [ ] **Luồng 2 (Tick Analytics):** Viết tính toán các chỉ số phức tạp dựa trên tick (ví dụ: VWAP - Volume Weighted Average Price, RSI theo giây, hoặc tương quan giá) để tận dụng sức mạnh xử lý cụm của Spark.
- [ ] Xử lý **Watermarking** chặt chẽ để drop hoặc gộp dữ liệu đến trễ (late data), đảm bảo trạng thái xử lý chính xác (**Exactly-once**) khi lưu hoặc stream.
- [ ] Đẩy dữ liệu đã tính toán ra 2 Kafka topics khác nhau: `binance-live-ticks` (cho thay đổi nhanh) và `binance-live-ohlc` (cho nến sliding).

### 3. Analytics & Backtesting (Spark Batch)
- [ ] Viết Spark Batch job để truy vấn dữ liệu tick/nến lịch sử của symbol từ MinIO (Parquet) hoặc MongoDB.
- [ ] Thực hiện **Broadcast Join** với bảng metadata symbol để làm giàu dữ liệu trước khi tính toán.
- [ ] Triển khai chiến thuật trading (ví dụ: MA Crossover) sử dụng **Window Functions** và **Pivot** để tính PnL theo tháng.
- [ ] Tích hợp **Spark MLlib** (ví dụ: Linear Regression) để dự đoán xu hướng giá ngắn hạn.

### 4. API & Backend Integration
- [ ] Viết API NestJS để truy vấn dữ liệu OHLC quá khứ từ MongoDB (để Dashboard hydrate biểu đồ lúc khởi tạo).
- [ ] NestJS Gateway: Tách biệt và Consume từ 2 Kafka topics (`binance-live-ticks` và `binance-live-ohlc`).
- [ ] Khởi tạo 2 kênh WebSocket riêng biệt để đẩy xuống Dashboard: kênh giá nhảy nhót (*flickering price*) và kênh cập nhật nến (*candle update*).
- [ ] Cấu hình **Redis** để lưu trạng thái giá/tick mới nhất và cache các chỉ báo phân tích.

### 5. Frontend & Visualization
- [ ] Nâng cấp màn hình Dashboard riêng cho symbol của mình.
- [ ] Hứng socket kênh `binance-live-ticks` để làm hiệu ứng nháy giá (màu xanh/đỏ) real-time như sàn giao dịch.
- [ ] Hứng socket kênh `binance-live-ohlc` để vẽ/cập nhật nến mượt mà từ Sliding Window mà không bị gián đoạn hay phải đợi hết 1 phút.
- [ ] Hiển thị danh sách Whale Alerts và kết quả Backtest/ML Prediction trực quan.

---

## Phần chung (Shared Infrastructure)
*Tất cả thành viên cùng phối hợp xây dựng phần móng:*

1. **Hạ tầng chung:** Thiết lập Docker Compose chung (Kafka, Spark Cluster, MongoDB, ES, **MinIO**) để mọi người cùng deploy code vào.
2. **Standardization:** Thống nhất định dạng Schema của `@aggTrade` và cấu trúc thư mục phân vùng Parquet trên MinIO.
3. **Kafka Topic Management:** Khởi tạo sẵn các topic với số lượng partition phù hợp để tránh nghẽn luồng tick.
4. **CI/CD & Monitoring:** Cùng nhau quản lý việc log và check sức khỏe của các container.

---

## Lợi ích của kiến trúc V2
- **Đúng chuẩn Big Data:** Thể hiện rõ đặc tính Velocity của Big Data khi xử lý hàng ngàn tick mỗi giây.
- **Tối ưu hóa UI/UX:** Dashboard trở nên "sống" với giá nhảy liên tục, khắc phục điểm nghẽn "đợi 1 phút mới thấy nến đổi" của kiến trúc cũ.
- **Thỏa mãn yêu cầu bài tập lớn:** Vận dụng được Watermarking, Sliding Window, và xử lý Late Data một cách thuyết phục.

**Last Updated**: 2026-06-11 (Updated to High-Frequency & Sliding Window Approach)
