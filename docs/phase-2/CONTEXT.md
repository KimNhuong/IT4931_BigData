* Project gồm 2 luồng: 
## Luồng đi ngược (On-Demand): Chạy theo cơ chế Pull (Khi nào user ra lệnh thì hệ thống mới lôi dữ liệu quá khứ ra Backtest). Luồng này Spark chạy dạng Batch Job (Chạy xong rồi nghỉ).

Thay vì dữ liệu liên tục chảy từ ngoài vào, luồng này kích hoạt khi nguồn phát động là User từ Dashboard gửi một lệnh tính toán nặng (ví dụ: chạy Backtest chiến lược trading trên dữ liệu lịch sử khổng lồ).

Dưới đây là phần giải thích luồng đi ngược chi tiết theo đúng format:

1. Sơ đồ luồng dữ liệu đi ngược (On-Demand Backtest Pipeline)
[ User / Dashboard ] 
         │  (Gửi cấu hình Backtest: BTCUSDT, 2024-2026, Chiến lược MA3)
         ▼
 ┌───────────────┐
 │  NestJS API   │ ──> [Hành động: Nhận request, ghi DB trạng thái PENDING]
 └───────┬───────┘
         │  (Emit/Produce Event Job)
         ▼
 ┌───────────────┐
 │  Kafka Topic  │ ──> [Topic: binance-backtest-jobs]
 └───────┬───────┘
         │  (Nhặt Job bất đồng bộ)
         ▼
 ┌───────────────┐
 │ Apache Spark  │ ──> [Hành động: Kéo dữ liệu lịch sử khổng lồ từ MongoDB]
 │  (Batch Job)  │ ──> [Tính toán: Window Functions, Pivot, Tính Lời/Lỗ]
 └───────┬───────┘
         │  (Produce kết quả Backtest)
         ▼
 ┌───────────────┐
 │  Kafka Topic  │ ──> [Topic: binance-backtest-results]
 └───────┬───────┘
         │  (Consume & Cập nhật kết quả)
         ▼
 ┌───────────────┐       (WebSockets)       ┌─────────────────┐
 │  NestJS API   │ ───────────────────────> │ User Dashboard  │
 └───────────────┘  [Lưu DB kết quả DONE]   └─────────────────┘
2. Chi tiết từng bước vận hành
Bước 1: User gửi yêu cầu & NestJS ghi nhận (Job Ingestion)
User ở giao diện Dashboard chọn cặp tiền, khoảng thời gian (ví dụ: 2 năm lịch sử) và thuật toán rồi bấm nút "Chạy Backtest".

Nhiệm vụ của NestJS API: Tiếp nhận HTTP Request. Thay vì thực hiện tính toán ngay (sẽ làm đơ toàn bộ Web Server), NestJS chỉ làm 2 việc cực nhanh:

Tạo một bản ghi trong Database (PostgreSQL/MongoDB) với trạng thái status: "PENDING".

Bắn một Event chứa thông tin Job (Cặp tiền, Ngày bắt đầu/kết thúc, Thuật toán) vào Kafka topic binance-backtest-jobs.

Tại sao làm vậy? Để giải phóng User ngay lập tức. Màn hình Dashboard của User sẽ hiện thông báo: "Đang xử lý, vui lòng đợi..." mà không bị quay vòng tròn chờ đợi API phản hồi (Timeout).

Bước 2: Trục xếp hàng và điều phối lệnh (Kafka Buffer)
Topic binance-backtest-jobs đóng vai trò như một hàng đợi (Queue).

Nếu có 100 người dùng bấm nút Backtest cùng một lúc, Kafka sẽ xếp hàng cả 100 Job này một cách an toàn. Các lệnh này không bị mất đi kể cả khi hệ thống tính toán phía sau đang bị quá tải hoặc đang bảo trì.

Bước 3: Tính toán Big Data hộp đen (Spark Batch Processing)
Cụm Apache Spark cài sẵn một Worker chuyên lắng nghe topic binance-backtest-jobs. Khi nhận được một gói tín hiệu Job:

Kéo dữ liệu lịch sử: Spark dựa vào symbol và khoảng thời gian để kết nối trực tiếp vào NoSQL DB (MongoDB) hốt hàng triệu dòng dữ liệu nến/tick lịch sử lên RAM phân tán.

Xử lý nâng cao: Spark thực hiện các hàm Window Functions để dựng lại chỉ báo (ví dụ MA3), chạy thuật toán giả lập mua/bán, dùng Pivot tính toán lợi nhuận/thua lỗ theo từng tháng/năm.

Sau khi tính ra các chỉ số cuối cùng (Tỷ lệ thắng, Drawdown, Profit), Spark đóng gói kết quả thành JSON và bắn vào Kafka topic binance-backtest-results.

Python
# Ví dụ đoạn code Spark lắng nghe Job từ Kafka và xử lý Batch dữ liệu lịch sử

kafka_df = spark.readStream.format("kafka").option("subscribe", "binance-backtest-jobs").load()

def process_backtest_job(df, batch_id):
    if df.count() > 0:
        job = df.collect()[0] # Lấy thông tin cấu hình từ User
        
        # 1. Kéo dữ liệu quá khứ từ MongoDB
        historical_df = spark.read.format("mongodb").option("collection", "BinanceTicks").load()
        
        # 2. Xử lý Window Function tính chỉ báo để Backtest chiến lược
        windowSpec = Window.partitionBy("symbol").orderBy("timestamp")
        analyzed_df = historical_df.withColumn("MA3", F.avg("close").over(windowSpec.rowsBetween(-2, 0)))
        
        # 3. Chạy logic chiến lược & GroupBy/Pivot để tính tổng kết quả Lời/Lỗ...
        result_payload = calculate_strategy_performance(analyzed_df, job['strategy'])
        
        # 4. Gửi trả kết quả về Kafka topic 'binance-backtest-results'
        # result_payload.write.format("kafka").option("topic", "binance-backtest-results").save()
Bước 4: NestJS nhận kết quả & Cập nhật Database
NestJS lúc này đóng vai trò là Consumer, túc trực lắng nghe từ topic binance-backtest-results.

TypeScript
// Trong NestJS Controller/Gateway
@MessagePattern('binance-backtest-results')
handleBacktestResults(@Payload() resultData: any) {
  // 1. Tìm lại Job trong Database (Postgres/Mongo) và cập nhật kết quả kèm trạng thái DONE
  this.backtestRepository.update(resultData.jobId, {
    status: 'DONE',
    metrics: resultData.metrics, // Chỉ số lời lỗ từ Spark gửi sang
  });

  // 2. Phát một tín hiệu WebSocket đến riêng User đã tạo Job đó
  this.webSocketGateway.server
    .to(resultData.userId)
    .emit('backtest-finished', { jobId: resultData.jobId, data: resultData.metrics });
}
Bước 5: Dashboard hiển thị kết quả cho cụ thể User
Trình duyệt của người dùng (vẫn đang mở hoặc vừa quay lại Dashboard) nhận được sự kiện backtest-finished qua kết nối WebSocket bảo mật. Màn hình lập tức thay đổi trạng thái từ "Đang xử lý..." sang việc hiển thị các biểu đồ trực quan, bảng số liệu tài chính chi tiết vừa được Spark tính toán xong mà không cần tải lại toàn bộ trang web.

## Luồng đi xuôi (Streaming): Chạy theo cơ chế Push (Dữ liệu từ Binance liên tục chảy qua hệ thống tạo thành dòng thác và tự động đẩy lên màn hình user). Luồng này Spark chạy dạng Continuous/Streaming Job (Bật 24/7 không bao giờ tắt).

... (nội dung cũ) ...

## 3. Tổng kết kiến trúc (Lambda & Kappa Alignment)

Hệ thống được thiết kế để tuân thủ cả hai mô hình xử lý dữ liệu hiện đại:
- **Kiến trúc Kappa:** Toàn bộ luồng dữ liệu (Streaming Flow) được xử lý qua Kafka và Spark Streaming, cho phép tái xử lý (Reprocessing) bằng cách đọc lại từ Kafka.
- **Kiến trúc Lambda:** Kết hợp luồng Batch (On-Demand Flow) để xử lý dữ liệu lịch sử khổng lồ từ MongoDB, đảm bảo tính chính xác cao cho các tác vụ không yêu cầu thời gian thực như Backtesting.

**Chi tiết phân chia công việc cho nhóm 5 người:** Xem tại [TEAM_TASK_DIVISION.md](./TEAM_TASK_DIVISION.md).