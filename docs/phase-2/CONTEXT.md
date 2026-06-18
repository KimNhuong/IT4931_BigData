# Tài Liệu Hệ Thống: Binance Real-Time Pipeline (Big Data)

Tài liệu mô tả chi tiết kiến trúc hệ thống, nghiệp vụ, luồng dữ liệu, cấu trúc dữ liệu, và các tích hợp kỹ thuật của dự án **Real-Time Binance Big Data Platform**.

---

## Mục lục (TOC)
- [A. Executive Summary](#a-executive-summary)
- [B. System Context & Actors](#b-system-context--actors)
- [C. High-level Architecture](#c-high-level-architecture)
- [D. Module Breakdown (BA View)](#d-module-breakdown-ba-view)
- [E. API Catalog](#e-api-catalog)
- [F. Data & Storage](#f-data--storage)
- [G. Realtime / Events / Messaging](#g-realtime--events--messaging)
- [H. Security](#h-security)
- [I. Configuration & Environments](#i-configuration--environments)
- [J. Error Handling, Logging, Observability](#j-error-handling-logging-observability)
- [K. Notable Technical Debt / Risks / TODOs](#k-notable-technical-debt--risks--todos)
- [L. Appendix](#l-appendix)

---

## A. Executive Summary

### 1. Hệ thống là gì?
Hệ thống **Real-Time Binance Big Data Platform** là một nền tảng thu thập, xử lý phân tán, lưu trữ đa tầng và trực quan hóa dữ liệu giao dịch tiền điện tử (Cryptocurrency) theo thời gian thực từ sàn giao dịch Binance. Nền tảng được thiết kế đặc thù để xử lý tải cao (high-frequency trade streams), phân tích chỉ số nến (OHLC) với độ trễ cực thấp (<100ms) và phục vụ chạy thử nghiệm (backtesting) các chiến thuật giao dịch trên tập dữ liệu lịch sử khổng lồ.

### 2. Hệ thống phục vụ ai?
- **Nhà giao dịch tài chính (Traders / Investors):** Theo dõi giá cả, khối lượng giao dịch thời gian thực và nhận cảnh báo cá voi (whale alerts) để đưa ra quyết định mua bán.
- **Nhà phân tích định lượng (Quantitative Analysts / BA):** Thiết kế và chạy thử nghiệm (backtest) các chiến thuật giao dịch (như MA Crossover, RSI Divergence) trên dữ liệu lịch sử để đánh giá hiệu quả chiến thuật.
- **Hệ thống giao dịch tự động (Trading Bots):** Tiêu thụ luồng sự kiện giá sạch, nến OHLC chuẩn hóa để tự động vào lệnh.

### 3. Bài toán giải quyết
- **Xử lý tốc độ cao (Velocity):** Luồng dữ liệu aggTrade từ Binance đẩy về liên tục (hàng ngàn tick/giây). Hệ thống phải hấp thụ và xử lý thời gian thực mà không gây nghẽn cổ chai hay treo giao diện người dùng.
- **Lưu trữ dữ liệu lớn (Volume & Variety):** Lưu trữ cả dữ liệu tick-level lịch sử phục vụ backtesting (hàng triệu bản ghi mỗi ngày) và dữ liệu nến đã tổng hợp phục vụ truy vấn nhanh.
- **Độ chính xác và Tính sẵn sàng cao:** Đảm bảo dữ liệu nến OHLC không bị mất mát hay trùng lặp (Exactly-once) ngay cả khi có sự cố hệ thống (sập node, mất kết nối mạng).

### 4. Các Capability chính của hệ thống
- **Thu thập dữ liệu thời gian thực (Real-time Ingestion):** Kết nối liên tục tới Binance WebSockets để lấy thông tin giao dịch khớp lệnh (`@aggTrade`).
- **Khởi tạo dữ liệu lịch sử (Dynamic Data Hydration):** Tải trực tiếp file dữ liệu lịch sử nén `.zip` từ Binance Vision, giải nén và đẩy vào pipeline thời gian thực dưới dạng dòng chảy sự kiện mà không ghi file trung gian xuống ổ cứng (Zero-Disk ETL).
- **Xử lý luồng phân tán (Real-time Stream Processing):** Sử dụng Apache Spark Structured Streaming để tổng hợp dữ liệu nến 1 phút (Tumbling Window) và phát hiện giao dịch cá voi đột biến (Whale Alerts).
- **Lưu trữ phân tán & Đa tầng (Hybrid Storage):** Sử dụng MinIO làm kho lưu trữ tệp tin phân tán (định dạng Parquet, phân vùng Hive-style) để lưu dữ liệu tick thô, kết hợp MongoDB lưu trữ nến OHLC và Redis làm bộ đệm cực nhanh phục vụ UI.
- **Động cơ Backtesting (On-Demand Backtest Engine):** Cho phép người dùng chạy thử nghiệm chiến thuật trên dữ liệu lịch sử thông qua hàng đợi Kafka bất đồng bộ.
- **Giao diện thời gian thực (Real-time Terminal):** Hiển thị biểu đồ nến động dạng chuyển động mượt mà (Morphing Candles) và cập nhật nháy giá (Flickering Prices) qua WebSocket.

### 5. Kiến trúc tổng quan
Hệ thống áp dụng mô hình lai **Lambda Architecture**:
- **Luồng đi xuôi (Streaming Flow):** `Binance WebSockets` -> `NestJS Ingestor` -> `Kafka (binance-raw-ticks)` -> `Apache Spark Structured Streaming` -> `Kafka (live topics)` -> `NestJS Gateway` -> `Socket.IO WebSockets` -> `React Frontend`.
- **Luồng đi ngược (Batch/Lambda Flow):** `React Frontend` -> `NestJS API (/backtest)` -> `Kafka (binance-backtest-jobs)` -> `Python/Spark Worker` -> `Truy vấn MongoDB/MinIO` -> `Kafka (binance-backtest-results)` -> `NestJS API` -> `Socket.IO` -> `React Frontend`.

---

## B. System Context & Actors

```
                 +-----------------------+
                 |  Binance Market APIs  |
                 +-----------+-----------+
                             | (WebSockets @aggTrade / REST klines / Zip historical)
                             v
+--------+       +-----------+-----------+       +---------------------+
| Trader | <---> | React Frontend (UI)   | <---> | NestJS API Gateway  |
+--------+       +-----------------------+       +----------+----------+
                                                            |
                                                            v
                                                 +----------+----------+
                                                 |    Apache Kafka     |
                                                 +----------+----------+
                                                            |
                                           +----------------+----------------+
                                           |                                 |
                                           v                                 v
                               +-----------+-----------+         +-----------+-----------+
                               | Spark Stream Engine   |         | Backtest Worker (Py)  |
                               +-----------+-----------+         +-----------+-----------+
                                           |                                 |
                                           +----------------+----------------+
                                                            |
                                                            v
                                                 +----------+----------+
                                                 | MongoDB / MinIO /   |
                                                 |    Redis Cache      |
                                                 +---------------------+
```

### 1. Danh sách Actors và phân quyền
- **End User / Trader (Actor ngoài):**
  - **Mục tiêu:** Theo dõi biến động giá cả thời gian thực, quản lý và chạy các chiến dịch kiểm thử chiến thuật (Backtesting).
  - **Quyền hạn:** Không yêu cầu xác thực (Open Access ở cấu hình hiện tại). Có quyền tạo yêu cầu backtest, xem biểu đồ, và nhận thông báo cá voi.
- **Binance WebSocket / REST API (Actor ngoài):**
  - **Mục tiêu:** Cung cấp nguồn dữ liệu thô (Real-time Ticks & Historical Klines).
  - **Quyền hạn:** Cấp quyền đọc công khai qua kết nối WebSocket/HTTPS công cộng.
- **NestJS Ingestor & Gateway (Hệ thống trong):**
  - **Mục tiêu:** Điều phối dòng chảy dữ liệu, lưu cache và trung chuyển tin nhắn xuống frontend.
  - **Quyền hạn:** Đọc/Ghi vào Kafka, Redis, MongoDB và MinIO S3.
- **Apache Spark / Python Workers (Hệ thống trong):**
  - **Mục tiêu:** Xử lý tính toán khối lượng lớn (Batch & Streaming).
  - **Quyền hạn:** Đọc Kafka đầu vào, đọc dữ liệu lịch sử từ MongoDB/MinIO S3, ghi kết quả ra Kafka.

### 2. Context Diagram (Dạng tương tác tin nhắn)
- **Luồng dữ liệu thời gian thực (Push):**
  1. `Binance WebSocket` gửi tin nhắn giao dịch `@aggTrade` đến [BinanceService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.service.ts).
  2. [BinanceService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.service.ts) lọc, đệm và đẩy JSON thô vào Kafka topic `binance-raw-ticks`.
  3. [ohlc_aggregator.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/streaming/ohlc_aggregator.py) (Spark Streaming) consume topic `binance-raw-ticks`, thực hiện gom nến 1 phút và lọc Whale Alerts, sau đó đẩy ngược lại Kafka các topic `binance-live-ohlc`, `binance-live-ticks`, `binance-whale-alerts`.
  4. [OhlcLiveController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/ohlc-live/ohlc-live.controller.ts) consume các topic live trên và chuyển tiếp qua [OhlcLiveGateway](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/ohlc-live/ohlc-live.gateway.ts) (WebSockets Socket.IO).
  5. `React Dashboard` nhận sự kiện `candle-update`, `tick-update`, `whale-alert` để cập nhật giao diện đồ thị.

- **Luồng chạy Backtest On-Demand (Pull):**
  1. `Trader` cấu hình chiến thuật trên Dashboard và nhấn nút "Chạy Backtest" -> Gửi request HTTP `POST /backtest`.
  2. [BacktestController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/backtest/backtest.controller.ts) nhận request, lưu Job trạng thái `PENDING` vào MongoDB collection `backtest_jobs`.
  3. [BacktestService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/backtest/backtest.service.ts) phát sự kiện `binance-backtest-jobs` chứa cấu hình chiến thuật vào Kafka.
  4. [backtest_consumer.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/streaming/backtest_consumer.py) (hoặc [backtest_job_consumer.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/batch/backtest_job_consumer.py) nếu chạy qua Spark) lắng nghe job mới, kéo dữ liệu lịch sử từ MongoDB/MinIO, chạy logic thuật toán mua/bán, tính toán chỉ số PnL & RMSE, rồi gửi kết quả về Kafka topic `binance-backtest-results`.
  5. [BacktestController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/backtest/backtest.controller.ts) bắt được kết quả từ Kafka, [BacktestService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/backtest/backtest.service.ts) cập nhật trạng thái `DONE`/`FAILED` vào MongoDB và phát tín hiệu qua WebSocket `backtest-finished` cho người dùng.

---

## C. High-level Architecture

Hệ thống được tổ chức thành 5 tầng kiến trúc chính và được cấu trúc hóa toàn bộ thông qua Docker Compose.

### 1. Sơ đồ tầng (Layers)
- **Presentation Layer (Client):** Giao diện Web SPA chạy React/TS, Vite. Hiển thị đồ thị nến bằng TradingView/Lightweight Charts.
- **API & Gateway Layer (Ingress):** NestJS Framework đảm nhận đón nhận HTTP Requests, duy trì kết nối WebSocket thời gian thực qua Socket.IO và đóng vai trò là Kafka Client gửi/nhận sự kiện.
- **Event Mesh / Message Bus Layer:** Apache Kafka chịu trách nhiệm lưu chuyển các dòng sự kiện một cách an toàn và bất đồng bộ, hỗ trợ lưu trữ đệm chịu lỗi.
- **Distributed Computing Layer:** Apache Spark Master & Workers thực hiện tính toán song song, phân tích dòng dữ liệu lớn thời gian thực hoặc chạy batch job phục vụ MLlib Linear Regression.
- **Storage / Persistance Layer:**
  - *Redis Cache:* Lưu trữ trạng thái nến 200 bản ghi gần nhất phục vụ tối ưu hóa cache (Lớp nóng).
  - *MongoDB:* Lưu dữ liệu có cấu trúc dạng nến OHLC phục vụ truy vấn lịch sử (Lớp ấm).
  - *MinIO / S3:* Lưu tệp tin Parquet nén, phân vùng phục vụ phân tích dữ liệu lịch sử lớn (Lớp lạnh).

### 2. Tech Stack chính và vai trò
| Công nghệ | Vai trò trong hệ thống | File cấu hình / Tham chiếu |
|---|---|---|
| **Node.js 20 & NestJS 11** | Backend API, Gateway WebSockets và Kafka Client | [package.json](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/package.json) |
| **Apache Kafka 7.5.0** | Trục xương sống phân phối sự kiện bất đồng bộ | [docker-compose.yml](file:///d:/realwork/BigData/IT4931_BigData/IT4931/docker-compose.yml#L15) |
| **Apache Spark 3.4.1** | Xử lý luồng (Structured Streaming) & Batch Analytics | [Dockerfile.spark](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/Dockerfile.spark) |
| **MongoDB Atlas / Local** | Cơ sở dữ liệu chính lưu trữ nến OHLC & Job Backtesting | [docker-compose.yml](file:///d:/realwork/BigData/IT4931_BigData/IT4931/docker-compose.yml#L213) |
| **MinIO** | Hệ thống lưu trữ đối tượng phân tán (S3 compatible) để lưu file Parquet | [docker-compose.yml](file:///d:/realwork/BigData/IT4931_BigData/IT4931/docker-compose.yml#L91) |
| **Redis 7** | Cache nến OHLC gần nhất, giảm tải đọc trực tiếp từ MongoDB | [docker-compose.yml](file:///d:/realwork/BigData/IT4931_BigData/IT4931/docker-compose.yml#L58) |
| **React 18 & Vite** | Frontend Dashboard trực quan hóa dữ liệu nến, giá nháy | [package.json](file:///d:/realwork/BigData/IT4931_BigData/IT4931/dashboard/package.json) |

### 3. Cách vận hành & Deploy (Docker Compose Ports)
Hệ thống được đóng gói trong một file [docker-compose.yml](file:///d:/realwork/BigData/IT4931_BigData/IT4931/docker-compose.yml). Các cổng dịch vụ được phân bổ như sau:
- **Nest.js API:** Port `3000` (Map ngoài máy chủ)
- **React Dashboard UI:** Port `5173` (Map tới port 80 trong container)
- **Apache Kafka Broker:** Port `9092` (External), Port `29092` (Internal)
- **Kafka UI Console:** Port `8080` (Giao diện trực quan xem Topic, Consumer Groups)
- **MinIO S3 Gateway:** Port `9000` (API), Port `9001` (Dashboard Console)
- **Redis Cache:** Port `6379`
- **MongoDB Local:** Port `27017` (Trong docker-compose hiện tại đang bị comment, hệ thống mặc định cấu hình MongoDB Atlas Cloud tại biến môi trường)
- **Spark Master Web UI:** Port `8081` (Xem trạng thái các Worker & Application Running)
- **Spark Master RPC:** Port `7077` (Worker kết nối tới Master)

---

## D. Module Breakdown (BA View)

Hệ thống bao gồm 6 phân hệ (Module) cốt lõi thực thi các trách nhiệm nghiệp vụ khác nhau:

### 1. Module Binance Ingestion & Hydration
- **Mục tiêu nghiệp vụ:** Đảm bảo hệ thống luôn có dữ liệu giá cập nhật tức thời cho 5 symbols lớn: BTC, ETH, SOL, BNB, XRP và có thể nạp nhanh dữ liệu cũ từ Binance Vision khi cần.
- **Use-cases chính:**
  - Kết nối và duy trì kết nối WebSocket tới luồng `@aggTrade` của Binance.
  - Tự động tải, giải nén và nạp dữ liệu lịch sử dạng streaming từ file zip hàng ngày của Binance Vision.
  - Seeding dữ liệu nến 1 phút lịch sử ban đầu từ Binance REST API `/klines` (lấy 1000 nến gần nhất).
- **Entrypoints:**
  - WebSocket Client kết nối đến `wss://stream.binance.com:9443/ws` trong [BinanceService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.service.ts).
  - API HTTP `POST /binance/hydrate` định tuyến tại [BinanceController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.controller.ts#L22).
- **Service chính & Trách nhiệm:**
  - [BinanceService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.service.ts): Quản lý WebSocket thô kết nối với Binance, lọc trùng lặp và đệm dữ liệu (Flush Interval 200ms) để đẩy sang Kafka topic `binance-raw-ticks`.
  - [HydrationService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/hydration.service.ts): Nhận cấu hình ngày bắt đầu/kết thúc, download file ZIP, stream unzip trực tiếp sang CSV parser và đẩy qua Kafka mà không ghi file trung gian xuống đĩa.
  - [StorageService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/storage.service.ts): Lắng nghe `binance-raw-ticks`, ghi trực tiếp từng tick vào MongoDB và đồng thời gom nhóm 1000 tick ghi xuống MinIO dưới dạng file Parquet.
- **Data Model liên quan:**
  - MongoDB Collections: `TICKS_${SYMBOL}` (lưu trữ dòng tick thô) và `OHLC_${SYMBOL}` (lưu nến klines seed).
  - MinIO Path: `year=YYYY/month=MM/day=DD/ticks_${timestamp}.parquet`.
- **Business Rules:**
  - Khi khởi động, nếu collection nến trống, [BinanceService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.service.ts) tự động gọi REST API lấy 1000 nến 1 phút gần nhất làm dữ liệu mồi (seeding) cho đồ thị.
  - Phải có proxy xoay cấu hình trong `BINANCE_PROXY_URL` để vượt qua lỗi chặn địa lý (Geoblocking) từ Binance ở Việt Nam/Cloud VPS.

### 2. Module Kafka Communication
- **Mục tiêu nghiệp vụ:** Cung cấp hạ tầng truyền dẫn tin nhắn thời gian thực và bất đồng bộ giữa các thành phần phần mềm.
- **Use-cases chính:**
  - Đăng ký Kafka Client, quản lý cơ chế xác thực SSL CA Certificate và SASL Mechanism.
  - Hỗ trợ NestJS tự động đăng ký microservice tiêu thụ tin nhắn từ các topic.
- **Entrypoints:** [kafka.module.ts](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/kafka/kafka.module.ts).
- **Quy tắc nghiệp vụ:**
  - Hỗ trợ phân tích cert PEM chứa dấu xuống dòng dạng `\n` trong biến môi trường thành file vật lý `/tmp/aiven_ca.pem` để Kafka Client tương thích với Aiven Cloud.

### 3. Module Real-Time Processing (Spark Streaming Engine)
- **Mục tiêu nghiệp vụ:** Phân tích, tính toán tổng hợp dữ liệu giao dịch lớn thành nến giá và phát hiện bất thường thời gian thực.
- **Use-cases chính:**
  - Tính toán nến OHLC (Open, High, Low, Close, Volume, VWAP) theo chu kỳ 1 phút.
  - Phát hiện Whale Alerts khi phát hiện giao dịch có giá trị lớn hơn ngưỡng cấu hình ($100k USD).
- **Entrypoints:** Đọc dữ liệu từ Kafka topic `binance-raw-ticks` thông qua Spark Structured Streaming trong [ohlc_aggregator.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/streaming/ohlc_aggregator.py).
- **Business Rules & Anomaly Detection:**
  - Áp dụng **Tumbling Window 1 phút** dựa trên trường `timestamp` (thay đổi thành định dạng Event Time trong Spark).
  - Áp dụng **Watermarking 10 giây** để xử lý dữ liệu bị trễ trên mạng internet.
  - Ngưỡng cá voi Whale Alerts mặc định là $100k USD (`WHALE_THRESHOLD_USD`).
- **Dependencies:** Lắng nghe dữ liệu từ Module Binance Ingestion, ghi dữ liệu kết quả nến thời gian thực sang Kafka.

### 4. Module On-Demand Backtest Engine
- **Mục tiêu nghiệp vụ:** Cung cấp môi trường kiểm thử các chiến thuật trading trên lịch sử dữ liệu lớn mà không ảnh hưởng tới luồng xử lý trực tuyến.
- **Use-cases chính:**
  - Trader gửi yêu cầu backtest với symbol, chiến thuật, khoảng thời gian.
  - Xử lý tính toán bất đồng bộ các chiến thuật giao dịch: `MA Crossover` và `RSI Divergence`.
- **Entrypoints:**
  - API REST `POST /backtest` định tuyến tại [BacktestController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/backtest/backtest.controller.ts#L9).
  - Kafka topics: `binance-backtest-jobs` và `binance-backtest-results`.
- **Service chính & Trách nhiệm:**
  - [BacktestService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/backtest/backtest.service.ts): Tiếp nhận request, lưu trữ trạng thái Job PENDING/DONE/FAILED vào DB, emit job cấu hình sang Kafka và broadcast WebSocket khi nhận kết quả.
  - Python worker [backtest_consumer.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/streaming/backtest_consumer.py): Consume job từ Kafka, truy xuất dữ liệu lịch sử trong MongoDB (nến lịch sử `OHLC_${SYMBOL}`), chạy thuật toán tính toán các chỉ số tài chính (PnL) và lỗi mô hình (RMSE), bắn ngược kết quả lại Kafka kết quả.
- **Data Model liên quan:** MongoDB collection `backtest_jobs`.
- **Quy tắc nghiệp vụ:**
  - Để tránh quá tải RAM trên hệ thống máy chủ phát triển (máy tính 8GB RAM), worker backtest mặc định chạy dạng Python thuần với `numpy` và `pymongo` thay vì khởi chạy cụm Spark nặng nề.
  - Hỗ trợ thuật toán **MA Crossover** (mua khi MA5 vượt MA20, bán khi MA5 dưới MA20) và **RSI Divergence** (mua khi RSI < 30, bán khi RSI > 70).

### 5. Module Real-Time Gateway & Caching (OhlcLive & Redis)
- **Mục tiêu nghiệp vụ:** Cung cấp nến OHLC lịch sử nhanh nhất cho giao diện người dùng và đẩy luồng giá trực tiếp qua Socket.IO.
- **Use-cases chính:**
  - Trả về danh sách 200 nến OHLC gần nhất phục vụ vẽ đồ thị khi người dùng tải trang lần đầu.
  - Phát các tin nhắn WebSocket để nhấp nháy giá, cập nhật hình dạng nến, và hiện pop-up cá voi.
- **Entrypoints:**
  - REST API `GET /ohlc-live/:symbol` định tuyến tại [OhlcLiveController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/ohlc-live/ohlc-live.controller.ts#L13).
  - Socket.IO Gateway [OhlcLiveGateway](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/ohlc-live/ohlc-live.gateway.ts).
- **Service chính & Trách nhiệm:**
  - [OhlcLiveService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/ohlc-live/ohlc-live.service.ts): Quản lý luồng logic lấy dữ liệu 200 nến gần nhất. Áp dụng đệm cache Redis (Cache key `ohlc_recent:${SYMBOL}`). Nếu Cache Miss mới truy cập MongoDB.
  - [RedisService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/redis/redis.service.ts): Cung cấp các thao tác pipeline atomic ghi và trim list cache phục vụ sliding window nến OHLC.

### 6. Module Frontend Terminal Dashboard
- **Mục tiêu nghiệp vụ:** Cung cấp trải nghiệm theo dõi thị trường tài chính trực quan, mượt mà và sinh động cho người dùng.
- **Use-cases chính:**
  - Kết nối Socket.IO tới cổng API Gateway.
  - Lựa chọn đồng tiền ảo muốn theo dõi.
  - Hiển thị đồ thị nến động liên tục cập nhật theo thời gian thực.
  - Hiển thị feed thông báo whale alerts trực quan.
- **Entrypoints:** React entrypoint [App.tsx](file:///d:/realwork/BigData/IT4931_BigData/IT4931/dashboard/src/App.tsx).
- **Logic quan trọng:**
  - Sử dụng React hook [useSocket.ts](file:///d:/realwork/BigData/IT4931_BigData/IT4931/dashboard/src/hooks/useSocket.ts) để quản lý vòng đời socket, tự động phát event `joinSymbol` mỗi khi người dùng thay đổi đồng coin muốn theo dõi, và lắng nghe dữ liệu cập nhật từ socket server.

---

## E. API Catalog

### 1. Nhóm Hydration & Binance Ingestion

#### POST /binance/hydrate
- **Mục đích:** Kích hoạt quá trình tải và nạp dữ liệu lịch sử từ Binance Vision.
- **Xác thực yêu cầu:** Không yêu cầu.
- **Input (JSON Body):**
  ```json
  {
    "symbol": "BTCUSDT",
    "startDate": "2026-01-01",
    "endDate": "2026-01-05"
  }
  ```
- **Validation Rule:** `symbol` phải là cặp tiền hợp lệ trên Binance (chữ in hoa), `startDate` và `endDate` đúng định dạng `YYYY-MM-DD`.
- **Output (HTTP Status 201 Created):**
  ```json
  {
    "message": "Hydration started in background",
    "symbol": "BTCUSDT",
    "startDate": "2026-01-01",
    "endDate": "2026-01-05"
  }
  ```
- **Side effects:**
  - Khởi chạy một vòng lặp bất đồng bộ trong background.
  - Gửi các gói tin raw ticks phân tích được vào Kafka topic `binance-raw-ticks`.
  - [StorageService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/storage.service.ts) sẽ hứng luồng này ghi MongoDB và MinIO Parquet.

---

### 2. Nhóm OHLC Live Data

#### GET /ohlc-live/:symbol
- **Mục đích:** Lấy 200 nến OHLC gần nhất phục vụ khởi tạo đồ thị.
- **Xác thực yêu cầu:** Không yêu cầu.
- **Input (Path Param):** `symbol` (ví dụ: `BTCUSDT`, `ETHUSDT`).
- **Output (HTTP Status 200 OK):**
  ```json
  [
    {
      "timestamp": 1711456020000,
      "open": 65000.5,
      "high": 65020.0,
      "low": 64990.0,
      "close": 65010.5,
      "volume": 12.54,
      "symbol": "BTCUSDT"
    }
  ]
  ```
- **Side effects:**
  - Truy cập cache Redis.
  - Nếu Cache Miss, truy vấn MongoDB collection `OHLC_${SYMBOL}`, lấy dữ liệu ra sắp xếp, lưu ngược lại vào Redis List cache.

---

### 3. Nhóm Backtesting

#### POST /backtest
- **Mục đích:** Tạo yêu cầu chạy thử nghiệm chiến thuật giao dịch trên lịch sử.
- **Xác thực yêu cầu:** Không yêu cầu.
- **Input (JSON Body):**
  ```json
  {
    "symbol": "BTCUSDT",
    "strategy": "MA Crossover",
    "timeRange": "2026-01-01 to 2026-01-10"
  }
  ```
- **Validation Rule:** `strategy` phải thuộc tập chiến thuật hỗ trợ (`MA Crossover` hoặc `RSI Divergence`).
- **Output (HTTP Status 201 Created):**
  ```json
  {
    "jobId": "667145602c3ef3001ad5aef1",
    "status": "PENDING"
  }
  ```
- **Side effects:**
  - Ghi bản ghi job trạng thái `PENDING` vào MongoDB collection `backtest_jobs`.
  - Bắn tin nhắn cấu hình job vào Kafka topic `binance-backtest-jobs`.

---

## F. Data & Storage

Dự án áp dụng mô hình lưu trữ đa cơ sở dữ liệu kết hợp bộ đệm để tối ưu hóa hiệu năng đọc/ghi.

### 1. MongoDB Schema

#### Collection: `backtest_jobs`
- **Mục đích:** Quản lý vòng đời và kết quả chạy thử nghiệm chiến thuật.
- **Cấu trúc dữ liệu:**
  ```typescript
  {
    _id: ObjectId,           // Mã định danh duy nhất của job
    symbol: string,          // Ví dụ: "BTCUSDT"
    strategy: string,        // Chiến thuật: "MA Crossover" hoặc "RSI Divergence"
    timeRange: string,       // Khoảng thời gian chạy test
    status: string,          // Trạng thái: "PENDING", "DONE", "FAILED"
    metrics?: {              // Kết quả tính toán chiến thuật (Chỉ xuất hiện khi DONE)
      totalProfit: number,   // Tổng lợi nhuận thu được
      rmse: number,          // Lỗi Root Mean Squared Error của dự đoán giá
      trades: number,        // Tổng số lệnh mua/bán đã thực hiện
      strategy: string       // Mô tả chiến thuật đầy đủ
    },
    error?: string,          // Chi tiết lỗi nếu status là FAILED
    createdAt: Date,         // Thời gian tạo job
    updatedAt?: Date         // Thời gian hoàn thành job
  }
  ```

#### Collection: `OHLC_${SYMBOL}` (ví dụ: `OHLC_BTCUSDT`)
- **Mục đích:** Lưu trữ thông tin nến 1 phút được seeding từ Binance REST API hoặc được lưu lại khi Spark Streaming xử lý xong.
- **Cấu trúc dữ liệu:**
  ```typescript
  {
    _id: ObjectId,
    timestamp: number,       // Thời gian bắt đầu cây nến (Epoch ms)
    open: number,            // Giá mở cửa nến
    high: number,            // Giá cao nhất trong phút
    low: number,             // Giá thấp nhất trong phút
    close: number,           // Giá đóng cửa nến
    volume: number,          // Khối lượng giao dịch trong phút
    closeTime: number,       // Thời gian kết thúc cây nến (Epoch ms)
    symbol: string           // Ký hiệu cặp tiền (ví dụ: "BTCUSDT")
  }
  ```

#### Collection: `TICKS_${SYMBOL}` (ví dụ: `TICKS_BTCUSDT`)
- **Mục đích:** Lưu trữ toàn bộ dữ liệu giao dịch tick thô nhận được từ websocket phục vụ sao lưu dữ liệu.
- **Cấu trúc dữ liệu:**
  ```typescript
  {
    _id: ObjectId,
    symbol: string,
    price: number,
    volume: number,
    timestamp: number,       // Thời gian giao dịch phía sàn
    tradeId: number,         // Mã trade của sàn Binance
    isMaker: boolean,        // Maker flag
    storedAt: Date           // Thời gian ghi nhận vào database cục bộ
  }
  ```

### 2. MinIO / S3 Storage Format
- Dữ liệu tick-level được nén ở dạng cột **Parquet** để giảm tải dung lượng ổ đĩa và tăng tốc độ đọc của Spark Batch Job.
- Đường dẫn lưu trữ phân vùng theo cấu trúc thư mục dạng Hive để tối ưu hóa truy vấn Spark:
  `s3a://<bucket_name>/year=YYYY/month=MM/day=DD/ticks_${timestamp}.parquet`

### 3. Redis Cache
- **Prefix:** `binance:`
- **Key:** `ohlc_recent:${SYMBOL}` (ví dụ: `binance:ohlc_recent:BTCUSDT`)
- **Kiểu dữ liệu:** **Redis List**
- **Cơ chế hoạt động:**
  - Mỗi khi có nến OHLC mới từ Kafka, [OhlcLiveService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/ohlc-live/ohlc-live.service.ts#L77) gọi hàm `pushToList`. Hàm thực hiện `rpush` đẩy nến vào cuối hàng, sau đó chạy lệnh `ltrim` để giữ lại đúng 200 bản ghi mới nhất.
  - Giúp trả về tức thời dữ liệu cho biểu đồ khi client reload trang.

---

## G. Realtime / Events / Messaging

Hệ thống điều phối tin nhắn qua 2 tầng trung gian: Apache Kafka và Socket.IO WebSockets.

### 1. Kafka Topics
| Tên Topic | Vai trò | Producer | Consumer |
|---|---|---|---|
| **binance-raw-ticks** | Dòng chảy tick giao dịch thô nhận được từ WebSocket Binance | `BinanceService` | `ohlc_aggregator.py` (Spark Streaming), `StorageService` (NestJS) |
| **binance-live-ticks** | Ticks sạch thời gian thực dùng để nháy số trên UI | `ohlc_aggregator.py` | `OhlcLiveController` |
| **binance-live-ohlc** | Nến OHLC đã tổng hợp theo chu kỳ 1 phút | `ohlc_aggregator.py` | `OhlcLiveController` |
| **binance-whale-alerts** | Cảnh báo giao dịch cá voi có giá trị lớn (> ngưỡng USD) | `ohlc_aggregator.py` | `OhlcLiveController` |
| **binance-backtest-jobs**| Yêu cầu tính toán backtest từ người dùng | `BacktestService` | `backtest_consumer.py` (Python Worker) / `backtest_job_consumer.py` (Spark) |
| **binance-backtest-results** | Kết quả tính toán chỉ số backtest | Python Worker / Spark | `BacktestController` (NestJS) |

### 2. Socket.IO WebSockets Events

#### Client -> Server
- **`joinSymbol`:** Đăng ký nhận sự kiện của một symbol nhất định.
  - **Payload:** Tên symbol viết hoa (ví dụ: `"BTCUSDT"`).
  - **Side-effects:** Tham gia phòng `room_BTCUSDT`.

#### Server -> Client
- **`tick-update`:** Đẩy giá tick mới nhất cho client trong room.
  - **Payload:** `{ symbol, price, volume, timestamp, tradeId, isMaker }`.
- **`candle-update`:** Đẩy nến OHLC 1 phút vừa chốt hoặc đang cập nhật.
  - **Payload:** `{ symbol, timestamp, open, high, low, close, volume, vwap }`.
- **`whale-alert`:** Phát thông báo giao dịch khối lượng lớn cho toàn bộ client.
  - **Payload:** `{ symbol, price, volume, timestamp, total_usd }` (với `total_usd = price * volume`).
- **`backtest-finished`:** Trả kết quả backtest bất đồng bộ cho client đã kích hoạt.
  - **Payload:** `{ jobId, symbol, status: "DONE" | "FAILED", metrics?: { totalProfit, rmse, trades, strategy }, error?: string }`.

---

## H. Security

### 1. Cơ chế xác thực & Phân quyền (AuthN & AuthZ)
- **Hệ thống phát triển (Development):**
  - Không có lớp bảo mật người dùng. API và WebSocket mở cho phép kết nối tự do không cần Access Token hay API Key.
  - Elasticsearch và Redis chạy cục bộ không yêu cầu mật khẩu.
- **Hệ thống kết nối Kafka:**
  - Hỗ trợ cơ chế **SASL_SSL** kết hợp tài khoản/mật khẩu và chứng chỉ CA (`KAFKA_CA_CERT`) để NestJS và Spark kết nối tới Aiven Cloud Kafka một cách an toàn.

### 2. Các rủi ro bảo mật & Biện pháp khắc phục (Hardening)
- **Rủi ro CORS & WebSockets:** Cho phép nguồn `origin: '*'` sẽ tạo cơ hội cho tấn công Cross-Site WebSocket Hijacking (CSWSH).
  - *Khắc phục:* Giới hạn CORS trong config về danh sách domain frontend tin cậy.
- **Rủi ro Injection trong MongoDB:** `BacktestService` dùng `ObjectId` trực tiếp từ giá trị parse JSON.
  - *Khắc phục:* Sử dụng thư viện validation như `class-validator` để kiểm tra định dạng `jobId` trước khi gọi database.
- **Rủi ro Dịch vụ (DoS):** Luồng hydration dữ liệu lịch sử gọi Binance Vision qua HTTP liên tục có thể làm quá tải hoặc nghẽn băng thông VPS.
  - *Khắc phục:* Giới hạn tần suất gọi (rate-limiting) hoặc giới hạn số lượng ngày tối đa được phép hydrate trong một yêu cầu.

---

## I. Configuration & Environments

### 1. Biến môi trường cốt lõi
| Biến môi trường | Ý nghĩa nghiệp vụ | Giá trị mẫu (Local) | Giá trị mẫu (Cloud) |
|---|---|---|---|
| **NODE_ENV** | Môi trường chạy backend | `development` | `production` |
| **PORT** | Cổng chạy NestJS HTTP Server | `3000` hoặc `7860` | `3000` |
| **KAFKA_BROKER** | Địa chỉ máy chủ Kafka Broker | `kafka:29092` | `kafka-xxxxx.aivencloud.com:23991` |
| **KAFKA_SASL_USERNAME** | Tên đăng nhập SASL Kafka | *Trống* | `avnadmin` |
| **KAFKA_SASL_PASSWORD** | Mật khẩu SASL Kafka | *Trống* | `AVNS_x_5mGy...` |
| **KAFKA_CA_CERT** | Chứng chỉ CA để xác thực SSL | *Trống* | Chuỗi PEM dài thay newline bằng `\n` |
| **MONGODB_URI** | URI kết nối cơ sở dữ liệu MongoDB | `mongodb://mongodb:27017` | `mongodb+srv://user:pass@cluster0...` |
| **REDIS_HOST** | Host kết nối Redis | `redis` | `redis-cloud-endpoint` |
| **REDIS_PORT** | Port kết nối Redis | `6379` | `6379` |
| **BINANCE_PROXY_URL** | Proxy trung gian để tránh lỗi chặn Binance | *Trống* | `http://172.235.214.159:1080` |
| **AWS_ACCESS_KEY** | Access key lưu trữ MinIO/S3 | `minioadmin` | `AKIAYV3ZZ3XI...` |
| **AWS_SECRET_KEY** | Secret key lưu trữ MinIO/S3 | `minioadmin` | `abwOQPAbf2+C...` |
| **S3_BUCKET** | Bucket lưu Parquet | `binance-raw-ticks` | `binance-data-it4931` |

### 2. So sánh cấu hình các môi trường
- **Môi trường Development (Local):**
  - Chạy toàn bộ hạ tầng qua Docker Compose.
  - Không bật SSL và xác thực cho Kafka, Redis, Elasticsearch.
  - Khởi tạo file log nhẹ, debug log level bật chi tiết (`debug`).
- **Môi trường Production (Cloud/Managed Services):**
  - Sử dụng Kafka Aiven được mã hóa TLS, MongoDB Atlas Cloud có lớp VPC Peering, AWS S3 thật tại Singapore (`ap-southeast-1`).
  - Redis cấu hình mật khẩu mạnh và tắt các lệnh nguy hiểm như `KEYS *`.
  - Log level được hạ xuống `info` hoặc `warn`, xuất log dạng JSON có cấu trúc để đẩy về hệ thống giám sát tập trung.

---

## J. Error Handling, Logging, Observability

### 1. Xử lý lỗi (Error Handling Patterns)
- **Lỗi kết nối WebSocket:** Khi mất kết nối tới Binance WebSocket API, [BinanceService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.service.ts#L198) bắt sự kiện `close`/`error` và thực hiện reconnect tự động sau mỗi 5 giây.
- **Lỗi xử lý file Hydration:** [HydrationService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/hydration.service.ts#L70) bọc khối stream unzip trong Promise. Nếu một ngày tải bị lỗi (ví dụ file zip chưa được sàn Binance tạo ra), Promise vẫn `resolve(false)` để vòng lặp tiếp tục xử lý các ngày tiếp theo mà không làm crash server.
- **Lỗi ghi Database:** Các khối lệnh lưu trữ tick/nến đều bọc trong `try/catch`. Nếu MongoDB quá tải hoặc Redis bị ngắt kết nối, lỗi được log ra console và hệ thống tiếp tục vận hành.

### 2. Ghi nhật ký (Logging)
- NestJS sử dụng console logger mặc định của framework.
- Spark Streaming cấu hình log level `WARN` (`spark.sparkContext.setLogLevel("WARN")`) để tránh spam hàng triệu dòng log thông tin tick vào container console, giúp dễ dàng nhận diện lỗi nghiêm trọng hơn.

### 3. Giám sát hệ thống (Observability)
- **Kafka UI Console (Port 8080):** Giám sát trực quan số lượng message đổ về các topic, tình trạng lệch offset (lag) của các Consumer Groups.
- **Spark Master UI (Port 8081):** Xem biểu đồ thực thi DAG, hiệu năng sử dụng RAM/CPU của Spark Workers.
- **MinIO Console (Port 9001):** Duyệt cấu trúc tệp tin Parquet được đẩy lên theo các phân vùng thời gian.

---

## K. Notable Technical Debt / Risks / TODOs

Dưới đây là các khoản nợ kỹ thuật và rủi ro phát hiện từ codebase hiện tại, kèm đề xuất cải tiến:

### 1. MongoDB Local bị comment out trong Docker Compose (Độ ưu tiên: P0)
- **Vấn đề:** Trong file [docker-compose.yml](file:///d:/realwork/BigData/IT4931_BigData/IT4931/docker-compose.yml#L75), container `mongodb` bị comment lại hoàn toàn. Khi chạy dev cục bộ, nếu người dùng không cấu hình biến môi trường `MONGODB_URI` trỏ tới MongoDB Atlas Cloud trong file `.env.local`, backend sẽ bị lỗi kết nối.
- **Đề xuất:** Khôi phục container MongoDB local trong docker-compose làm cấu hình mặc định khi dev local.

### 2. Module ElasticSearch hoàn toàn trống rỗng (Độ ưu tiên: P0)
- **Vấn đề:** File [elastic-search.service.ts](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/elastic-search/elastic-search.service.ts) và [elastic-search.controller.ts](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/elastic-search/elastic-search.controller.ts) hiện chỉ là các class rỗng chưa được triển khai bất kỳ logic ghi/truy vấn nào, mặc dù Elasticsearch và Kibana vẫn được bật trong Docker Compose.
- **Đề xuất:** Hoàn thiện code tích hợp Client Elasticsearch trong NestJS để ghi chỉ mục các nến OHLC phục vụ Kibana Dashboard, hoặc gỡ bỏ dịch vụ Elasticsearch/Kibana ra khỏi Docker Compose nếu không có nhu cầu sử dụng thực tế nhằm tiết kiệm tài nguyên RAM.

### 3. Thiếu lớp Xác thực & Phân quyền (Độ ưu tiên: P1)
- **Vấn đề:** REST API và WebSockets của NestJS mở hoàn toàn công khai. Bất kỳ ai cũng có thể gọi `POST /backtest` hoặc `POST /binance/hydrate` liên tục gây quá tải hệ thống.
- **Đề xuất:** Bổ sung JWT authentication middleware cho các API đột biến trạng thái.

### 4. Tách biệt Collection MongoDB theo từng Symbol (Độ ưu tiên: P2)
- **Vấn đề:** Hệ thống đang ghi dữ liệu nến vào các collection phân tách động: `OHLC_BTCUSDT`, `OHLC_ETHUSDT`... Cách thiết kế này gây khó khăn nếu BA muốn truy vấn phân tích tương quan giá chéo giữa các đồng tiền (Cross-symbol analysis).
- **Đề xuất:** Lưu chung dữ liệu nến vào một collection duy nhất tên là `ohlc_candles`, đánh chỉ mục phức hợp (Compound Index) trên hai trường `{ symbol: 1, timestamp: -1 }`.

---

## L. Appendix

### 1. Danh sách file "Điểm vào" (Entrypoints) quan trọng
- **NestJS Server Bootstrap:** [main.ts](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/main.ts)
- **NestJS AppModule Registry:** [app.module.ts](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/app.module.ts)
- **React Frontend entrypoint:** [main.tsx](file:///d:/realwork/BigData/IT4931_BigData/IT4931/dashboard/src/main.tsx)
- **Spark Real-time Aggregator:** [ohlc_aggregator.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/streaming/ohlc_aggregator.py)
- **Backtest Lightweight Worker:** [backtest_consumer.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/streaming/backtest_consumer.py)
- **Spark Batch Backtest Worker:** [backtest_job_consumer.py](file:///d:/realwork/BigData/IT4931_BigData/IT4931/spark-processing/batch/backtest_job_consumer.py)

### 2. Bảng mapping luồng xử lý (Route -> Controller -> Service -> Model)

| Route / Topic | Controller | Service chính | Data Model / Collection | Side-effects |
|---|---|---|---|---|
| **POST /binance/hydrate** | [BinanceController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.controller.ts) | [HydrationService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/hydration.service.ts) | *Không ghi trực tiếp* | Tải zip lịch sử từ Binance Vision, un-zip, parse CSV thành các sự kiện ticks đẩy vào Kafka topic `binance-raw-ticks` |
| **binance-raw-ticks** *(Kafka)* | [BinanceController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/binance.controller.ts) | [StorageService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/binance-ingest/src/binance/storage.service.ts) | MongoDB `TICKS_${SYMBOL}`, MinIO Parquet files | Ghi dữ liệu giao dịch tick thô vào database lâu dài và đẩy dữ liệu lên MinIO theo batch 1000 phần tử |
| **GET /ohlc-live/:symbol** | [OhlcLiveController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.controller.ts) | [OhlcLiveService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.service.ts), [RedisService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/redis/redis.service.ts) | Redis cache `ohlc_recent:${SYMBOL}`, MongoDB `OHLC_${SYMBOL}` | Trả về 200 nến OHLC gần nhất. Nếu Cache Miss, đọc MongoDB rồi populate cache ngược lại Redis |
| **binance-live-ohlc** *(Kafka)* | [OhlcLiveController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.controller.ts) | [OhlcLiveService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.service.ts) | Redis cache `ohlc_recent:${SYMBOL}` | Đẩy nến 1 phút thời gian thực mới lên cho client qua event WebSocket `candle-update` |
| **binance-live-ticks** *(Kafka)* | [OhlcLiveController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.controller.ts) | [OhlcLiveService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.service.ts) | *Không ghi* | Phát tín hiệu WebSocket `tick-update` cho room của symbol tương ứng để cập nhật giá nháy nhấp nháy xanh/đỏ |
| **binance-whale-alerts** *(Kafka)* | [OhlcLiveController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.controller.ts) | [OhlcLiveService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/ohlc-live/ohlc-live.service.ts) | *Không ghi* | Broadcast thông báo cá voi giao dịch lớn qua WebSocket event `whale-alert` tới toàn bộ client |
| **POST /backtest** | [BacktestController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/backtest/backtest.controller.ts) | [BacktestService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/backtest/backtest.service.ts) | MongoDB `backtest_jobs` | Tạo bản ghi Job với status `PENDING`, phát event cấu hình chạy test sang Kafka topic `binance-backtest-jobs` |
| **binance-backtest-results** *(Kafka)* | [BacktestController](file:///d:/realwork/BigData/IT4931_BigData/IT4931/backtest/backtest.controller.ts) | [BacktestService](file:///d:/realwork/BigData/IT4931_BigData/IT4931/backtest/backtest.service.ts) | MongoDB `backtest_jobs` | Cập nhật kết quả tính toán chiến thuật và chuyển trạng thái job thành `DONE` hoặc `FAILED`, phát tín hiệu WebSocket `backtest-finished` cho client |