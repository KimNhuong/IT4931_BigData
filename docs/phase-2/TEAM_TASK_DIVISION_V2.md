# Phase 2: Team Task Division V2 (High-Frequency & Sliding Window Approach)

*Cập nhật theo kiến trúc "Tick-level Processing" để đáp ứng đúng bản chất Real-time Streaming của Big Data.*

Thay vì chia theo chức năng (Role), nhóm sẽ chia theo **Cặp tiền (Symbol)**. Mỗi thành viên sẽ chịu trách nhiệm phát triển **toàn bộ pipeline (End-to-End)** cho symbol được giao. Cách tiếp cận này giúp mọi thành viên đều được trải nghiệm và làm chủ toàn bộ các công nghệ trong hệ thống Big Data (NestJS, Kafka, Spark, MongoDB, Elasticsearch, React).

## Phân chia Symbol
- **Thành viên 1:** BTCUSDT --> NhuongDK
- **Thành viên 2:** ETHUSDT --> AnhNQ
- **Thành viên 3:** SOLUSDT --> LoiT
- **Thành viên 4:** BNBUSDT --> NhanNX
- **Thành viên 5:** XRPUSDT --> DaiND

## Quy trình phát triển (Áp dụng cho mỗi Thành viên)

### 1. High-Frequency Ingestion & Dynamic Hydration
- [ ] **Real-time Ingestion:** Chuyển sang subscribe luồng `@aggTrade` (tick-level) để lấy từng giao dịch riêng lẻ từ Binance WebSocket.
- [ ] **Dynamic Data Hydration (New):** Triển khai service tải dữ liệu lịch sử trực tiếp từ Binance Vision (Zip URL) -> Stream Unzip -> Parse -> Push vào Kafka. Không lưu file trung gian trên ổ cứng (Zero-Disk ETL).
- [ ] **Hybrid Storage:** Lưu trữ đồng thời vào **MongoDB** (truy vấn nhanh) và **MinIO** (định dạng **Parquet**, Hive-style partitioning) để thỏa mãn yêu cầu Lưu trữ phân tán.

### 2. Dual-Stream Real-time Processing (Spark Streaming)
- [ ] **Luồng 1 - Raw Ticks (Velocity):** Lọc các giao dịch từ Kafka và đẩy thẳng sang topic `binance-live-ticks` (cho UI nháy giá) và phát hiện **Whale Alerts** (giao dịch > 100k USD).
- [ ] **Luồng 2 - Sliding Window OHLC (Complexity):** Áp dụng **Sliding Window** (1 phút window, 2 giây slide) để tính toán OHLC. Kết quả đẩy vào topic `binance-live-ohlc`.
- [ ] **Advanced Analytics:** Tính toán VWAP (Volume Weighted Average Price) và các chỉ số real-time khác bằng Spark.
- [ ] **Watermarking:** Xử lý dữ liệu đến trễ, đảm bảo tính nhất quán (Exactly-once) cho cả Cold và Hot Storage.

### 3. Analytics & Backtesting (Spark Batch)
- [ ] Truy vấn dữ liệu Parquet từ MinIO bằng Spark Batch job.
- [ ] Sử dụng **Broadcast Join** để tối ưu hiệu năng khi kết hợp dữ liệu giao dịch với metadata symbol.
- [ ] Triển khai chiến thuật trading (ví dụ: MA Crossover) bằng **Window Functions** và **Pivot**.
- [ ] Tích hợp **Spark MLlib** để dự đoán xu hướng giá ngắn hạn.

### 4. Backend & API Integration
- [ ] NestJS Gateway: Consume đồng thời từ 2 Kafka topics (`binance-live-ticks` và `binance-live-ohlc`).
- [ ] WebSocket Broadcasting: Đẩy dữ liệu xuống Dashboard qua các event tương ứng (`tick-update`, `candle-update`, `whale-alert`).
- [ ] Cấu hình Redis để cache trạng thái nến hiện tại và các chỉ báo quan trọng.

### 5. Frontend & High-End UX
- [ ] **Flickering Price Effect:** Hứng luồng raw ticks để cập nhật giá nháy xanh/đỏ liên tục, thể hiện đặc tính Velocity.
- [ ] **Morphing Candle Effect:** Hứng luồng sliding window để cập nhật "hình dáng" cây nến hiện tại mỗi 2 giây, tạo hiệu ứng chuyển động mượt mà (Morphing).
- [ ] **Whale Alerts Widget:** Hiển thị thông báo các giao dịch lớn theo thời gian thực với hiệu ứng nổi bật.

---

## Bài học kinh nghiệm (Lesson Learned)
**Xử lý nghẽn cổ chai (Bottleneck) ở Frontend khi hiển thị Real-time Data:**
- **Thách thức:** Đẩy hàng ngàn tick/giây lên UI sẽ gây treo trình duyệt. Nếu dùng Tumbling Window 1 phút tĩnh thì trải nghiệm người dùng bị "giật cục".
- **Giải pháp:** Tách làm 2 luồng hiển thị. Sử dụng luồng **Raw Ticks** nhẹ nhàng để nháy số (DOM update rẻ). Sử dụng sức mạnh xử lý cụm của Spark Streaming để tính toán **Sliding Window** (1 phút, trượt 2 giây), giúp Frontend chỉ phải render lại nến mỗi 2 giây, tạo cảm giác nến "chuyển động mượt mà" mà vẫn tối ưu hiệu năng.

---

**Last Updated**: 2026-06-15 (Integrated Dynamic Hydration & Dual-Stream UI Logic)
