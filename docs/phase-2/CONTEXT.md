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

    1. Sơ đồ luồng dữ liệu đi xuôi (Real-time Pipeline)
    [Binance API / WebSocket] 
            │  (Dòng dữ liệu thô / Tần suất cực cao)
            ▼
    ┌───────────────┐
    │ NestJS Ingest │ (Hoặc Worker Node.js/Go chuyên hứng Stream)
    └───────┬───────┘
            │  (Produce nhanh)
            ▼
    ┌───────────────┐
    │  Kafka Topic  │ ──> [Topic: binance-raw-ticks]
    └───────┬───────┘
            │  (Consume liên tục)
            ▼
    ┌───────────────┐
    │ Apache Spark  │ (Spark Structured Streaming)
    │  Streaming    │ ──> [Tính toán: Window 1m/5m, Khối lượng, Cá mập mua bán]
    └───────┬───────┘
            │  (Produce kết quả đã tinh chế)
            ▼
    ┌───────────────┐
    │  Kafka Topic  │ ──> [Topic: binance-aggregated-metrics]
    └───────┬───────┘
            │  (Consume & Đẩy Real-time)
            ▼
    ┌───────────────┐       (WebSockets)       ┌─────────────────┐
    │  NestJS API   │ ───────────────────────> │ User Dashboard  │
    └───────────────┘                          └─────────────────┘
    2. Chi tiết từng bước vận hành

        Bước 1: Hứng dữ liệu từ Binance (Data Ingestion)
        Thay vì dùng HTTP REST API (bị giới hạn rate limit), hệ thống sẽ kết nối tới Binance WebSocket Market Streams (ví dụ: Stream @ticker hoặc @kline).

        Nhiệm vụ của NestJS Worker: Thiết lập kết nối WebSocket với Binance. Mỗi khi nhận được một "tick" dữ liệu (giá thay đổi), nó lập tức chuyển tiếp (Produce) payload thô đó vào Kafka topic binance-raw-ticks.

        Tại sao không xử lý luôn? Vì dữ liệu Binance đổ về có thể lên tới hàng nghìn tick/giây vào lúc thị trường biến động. NestJS cần phải đẩy ngay vào Kafka để giải phóng bộ nhớ, tránh nghẽn Event Loop.

        Bước 2: Trục truyền tải dữ liệu thô (Kafka Buffer)
        Topic binance-raw-ticks được cấu hình với nhiều Partitions (Phân mảnh), mỗi partition có thể đại diện cho một nhóm các cặp tiền (Ví dụ: Partition 0 giữ BTC, Partition 1 giữ ETH,...). Kafka sẽ lưu trữ tạm thời dòng dữ liệu thô này với độ trễ gần như bằng 0 (vài miligiây).

        Bước 3: Xử lý dòng dữ liệu thời gian thực (Spark Structured Streaming)
        Đây là nơi các kỹ thuật Window Functions và Tổng hợp nâng cao phát huy tác dụng ở dạng Real-time chứ không phải trên dữ liệu lịch sử nữa. Spark Streaming sẽ "gặm" dữ liệu liên tục từ binance-raw-ticks:

        Tạo nến tùy biến (Tumbling/Sliding Window): Gom các tick dữ liệu trong vòng đúng 1 phút để tự tạo ra giá Open, High, Low, Close, Volume (OHLCV) mà không phụ thuộc vào nến của Binance.

        Phát hiện bất thường (Anomalies): Sử dụng hàm cửa sổ trượt (Sliding Window) 5 phút để tính toán: Nếu Volume trong 5 phút qua đột ngột cao gấp 3 lần trung bình 1 tiếng trước đó -> Gắn nhãn "Whale Alert" (Cá mập gom hàng).

        Sau khi tính toán xong, Spark đẩy kết quả sang một bộ lọc tinh chế hơn: Kafka topic binance-aggregated-metrics.

        Python
        # Ví dụ đoạn code Spark Streaming xử lý cửa sổ thời gian thực từ Kafka
        stream_df = spark.readStream.format("kafka").option("subscribe", "binance-raw-ticks").load()

        # Tính tổng khối lượng giao dịch của mỗi Coin trong cửa sổ trượt 5 phút, cập nhật mỗi 1 phút
        aggregated_df = stream_df \
            .groupBy(
                F.window(col("timestamp"), "5 minutes", "1 minute"),
                col("symbol")
            ).agg(F.sum("volume").alias("total_volume_5m"))
        Bước 4: NestJS tiêu thụ dữ liệu tinh chế & Phát WebSocket
        NestJS Microservice lúc này sẽ lắng nghe (Consume) từ topic binance-aggregated-metrics. Lúc này dữ liệu đã "sạch" và nhẹ hơn rất nhiều vì đã được Spark gom nhóm (Ví dụ: cứ 1 giây hoặc 1 phút mới có 1 bản ghi kết quả thay vì hàng nghìn tick thô).

        TypeScript
        // Trong NestJS Gateway
        @MessagePattern('binance-aggregated-metrics')
        handleRealtimeMetrics(@Payload() data: any) {
        // 1. Lưu nhanh vào Redis hoặc TimescaleDB để vẽ biểu đồ lịch sử gần
        this.cacheService.setLatest(data.symbol, data);

        // 2. Bắn thẳng qua WebSocket cho các Client đang mở Dashboard và đăng ký xem cặp coin đó
        this.webSocketGateway.server.to(data.symbol).emit('market-update', data);
        }
        Bước 5: Dashboard hiển thị
        Trình duyệt của người dùng kết nối WebSocket tới NestJS, nhận được gói dữ liệu market-update và cập nhật biểu đồ (TradingView chart), danh sách Whale Alert, hoặc bảng so sánh giá (đã qua xử lý Pivot) lập tức mà không cần F5 lại trang.
    