# Hệ Thống Xử Lý Dữ Liệu Real-time Binance (Big Data)

Tài liệu này mô tả kiến trúc và luồng hoạt động của hệ thống thu thập, xử lý và trực quan hóa dữ liệu giá tiền điện tử theo thời gian thực.

---

## 1. Apache Kafka: Hệ thống thu thập và truyền tải (Ingestion)
Trong bài toán này, Kafka đóng vai trò là **"người vận chuyển"** và **bộ đệm (Buffer)**.

*   **Nguồn phát (Producer):** Một Script (thường bằng Python) kết nối với **Binance WebSocket API**. Mỗi khi giá BTC/USDT thay đổi, Script này sẽ đẩy dữ liệu đó vào một Kafka Topic (ví dụ: `crypto-prices`).
*   **Tại sao cần Kafka?**
    *   **Tốc độ cao:** Giá Binance cập nhật liên tục (vài mili giây một lần). Kafka có khả năng chịu tải cực tốt, giúp hệ thống không bị "sập" nếu dữ liệu đổ về quá nhanh.
    *   **Tính ổn định:** Nếu Spark bị dừng đột ngột để bảo trì, dữ liệu vẫn nằm an toàn trong Kafka và Spark có thể đọc tiếp ngay khi khởi động lại.
*   **Dữ liệu thô (JSON):**
    ```json
    {"symbol": "BTCUSDT", "price": "65000.50", "timestamp": 1711456000}
    ```

## 2. Apache Spark (Spark Streaming): Xử lý dữ liệu (Processing)
Đây là **"bộ não"** của hệ thống, nơi biến dữ liệu thô thành thông tin có ý nghĩa.

*   **Cửa sổ thời gian (Windowing):** Vì bạn muốn tính trung bình mỗi phút, Spark sẽ gom các bản ghi trong vòng 60 giây lại một nhóm.
*   **Nhiệm vụ chính:**
    *   **Aggregation:** Tính toán $Average\_Price$, $Max\_Price$, $Min\_Price$ trong mỗi phút.
    *   **Tạo dữ liệu Nến (OHLC):** Spark sẽ xác định giá Mở cửa (Open), Cao nhất (High), Thấp nhất (Low), và Đóng cửa (Close) trong phút đó.
*   **Tại sao dùng Spark?** Nó xử lý song song và cực nhanh trên các "micro-batches", đảm bảo độ trễ (latency) dưới 1 giây.

## 3. Elasticsearch: Lưu trữ và đánh chỉ mục (Storage & Indexing)
Sau khi Spark xử lý xong, kết quả được lưu trữ để có thể truy vấn nhanh.

*   **Cấu trúc dữ liệu:** Elasticsearch lưu dưới dạng **Document (JSON)**. Mỗi "cây nến" 1 phút sẽ là một bản ghi.
*   **Index:** Tạo một Index tên là `binance-ohlc` để chứa kết quả từ Spark đổ vào.
*   **Tại sao dùng Elasticsearch?**
    *   **Search Engine:** Việc tìm kiếm giá của một ngày bất kỳ trong hàng triệu bản ghi diễn ra gần như tức thời.
    *   **Time-series:** Tối ưu hóa tuyệt vời cho dữ liệu theo thời gian.

## 4. Kibana: Hiển thị và theo dõi (Visualization)
Kibana là **giao diện** để người dùng tương tác với dữ liệu nằm trong Elasticsearch.

*   **Dashboard:** Tạo các biểu đồ nến (Candlestick Chart) để xem xu hướng giá.
*   **Real-time Refresh:** Tự động làm mới (ví dụ: mỗi 5 giây) để cập nhật những cây nến mới nhất mà không cần tải lại trang.
*   **Kibana Lens:** Công cụ kéo thả giúp dễ dàng tạo biểu đồ cột (Volume) hoặc biểu đồ đường (Giá trung bình) mà không cần viết code.

---

## Tóm tắt luồng hoạt động (Data Flow)

$$Binance\ API \rightarrow Kafka\ Producer \rightarrow Kafka\ Topic \rightarrow Spark\ Streaming \rightarrow Elasticsearch \rightarrow Kibana$$

1.  **Binance API** $\rightarrow$ (JSON thô) $\rightarrow$ **Kafka Producer**.
2.  **Kafka Topic** $\rightarrow$ (Dòng dữ liệu) $\rightarrow$ **Spark Streaming**.
3.  **Spark** $\rightarrow$ (Tính toán OHLC/Trung bình) $\rightarrow$ **Elasticsearch**.
4.  **Elasticsearch** $\rightarrow$ (Truy vấn) $\rightarrow$ **Kibana Dashboard**.