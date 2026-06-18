"""
Backtest Job Consumer - Lightweight (kafka-python + pymongo)
============================================================
Đọc backtest jobs từ Kafka topic 'binance-backtest-jobs',
chạy chiến lược trên dữ liệu OHLC từ MongoDB,
gửi kết quả vào Kafka topic 'binance-backtest-results'.

Chạy độc lập, KHÔNG dùng Spark (tránh tranh chấp RAM trên máy 8GB).
"""
import os
import json
import ssl
import time
import numpy as np
from kafka import KafkaConsumer, KafkaProducer
from pymongo import MongoClient

# -------------------------------------------------------
# Configuration từ Environment
# -------------------------------------------------------
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
KAFKA_SASL_USERNAME = os.getenv("KAFKA_SASL_USERNAME", "")
KAFKA_SASL_PASSWORD = os.getenv("KAFKA_SASL_PASSWORD", "")
KAFKA_SASL_MECHANISM = os.getenv("KAFKA_SASL_MECHANISM", "SCRAM-SHA-256").upper()
MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://localhost:27017/binance"
MONGO_DATABASE = "binance"

CA_CERT_TXT = os.getenv("KAFKA_CA_CERT", "").replace("\\n", "\n").replace("\r", "").strip()
CA_CERT_PATH = "/tmp/aiven_ca.pem"

if CA_CERT_TXT:
    with open(CA_CERT_PATH, "w") as f:
        f.write(CA_CERT_TXT)
    print(f"[Backtest] CA cert written to {CA_CERT_PATH}")


def get_kafka_config():
    """Build kafka-python config dict for SASL_SSL."""
    config = {
        "bootstrap_servers": KAFKA_BROKER,
    }
    if KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD:
        config["security_protocol"] = "SASL_SSL"
        config["sasl_mechanism"] = KAFKA_SASL_MECHANISM
        config["sasl_plain_username"] = KAFKA_SASL_USERNAME
        config["sasl_plain_password"] = KAFKA_SASL_PASSWORD

        if os.path.exists(CA_CERT_PATH):
            ssl_ctx = ssl.create_default_context(cafile=CA_CERT_PATH)
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            config["ssl_context"] = ssl_ctx
    return config


# -------------------------------------------------------
# Backtest Strategies
# -------------------------------------------------------
def strategy_ma_crossover(ohlc_data: list) -> dict:
    """
    MA Crossover Strategy: Buy when MA5 > MA20, Sell when MA5 < MA20.
    Tính trên dữ liệu OHLC 1 phút từ MongoDB.
    """
    if len(ohlc_data) < 25:
        return {"totalProfit": 0.0, "rmse": 0.0, "trades": 0, "strategy": "MA Crossover"}

    closes = np.array([d["close"] for d in ohlc_data], dtype=float)

    # Tính Moving Averages
    ma5 = np.convolve(closes, np.ones(5) / 5, mode='valid')
    ma20 = np.convolve(closes, np.ones(20) / 20, mode='valid')

    # Align arrays (MA20 bắt đầu muộn hơn MA5 15 phần tử)
    offset = len(ma5) - len(ma20)
    ma5_aligned = ma5[offset:]
    closes_aligned = closes[19:]  # MA20 bắt đầu từ index 19

    # Generate signals: 1 = long, 0 = flat
    signals = (ma5_aligned > ma20).astype(int)

    # Tính PnL: profit = signal[i-1] * (close[i] - close[i-1])
    price_changes = np.diff(closes_aligned)
    pnl = signals[:-1] * price_changes
    total_profit = float(np.nansum(pnl))
    trades = int(np.sum(np.abs(np.diff(signals))))

    # Simple RMSE: dự đoán giá tiếp = MA5, so với giá thực
    predictions = ma5_aligned[:-1]
    actuals = closes_aligned[1:]
    rmse = float(np.sqrt(np.mean((predictions - actuals) ** 2)))

    return {
        "totalProfit": round(total_profit, 2),
        "rmse": round(rmse, 2),
        "trades": trades,
        "strategy": "MA Crossover (MA5 > MA20)"
    }


def strategy_rsi_divergence(ohlc_data: list) -> dict:
    """
    RSI Divergence Strategy: Buy when RSI < 30, Sell when RSI > 70.
    """
    if len(ohlc_data) < 20:
        return {"totalProfit": 0.0, "rmse": 0.0, "trades": 0, "strategy": "RSI Divergence"}

    closes = np.array([d["close"] for d in ohlc_data], dtype=float)

    # Tính RSI (14-period)
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    period = 14
    avg_gain = np.convolve(gains, np.ones(period) / period, mode='valid')
    avg_loss = np.convolve(losses, np.ones(period) / period, mode='valid')

    # Tránh chia cho 0
    avg_loss = np.where(avg_loss == 0, 1e-10, avg_loss)
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    closes_aligned = closes[period:]
    min_len = min(len(rsi), len(closes_aligned))
    rsi = rsi[:min_len]
    closes_aligned = closes_aligned[:min_len]

    # Signals: 1 = long khi RSI < 30, 0 = flat khi RSI > 70
    signals = np.zeros(len(rsi))
    position = 0
    for i in range(len(rsi)):
        if rsi[i] < 30:
            position = 1
        elif rsi[i] > 70:
            position = 0
        signals[i] = position

    # Tính PnL
    price_changes = np.diff(closes_aligned)
    pnl = signals[:-1] * price_changes
    total_profit = float(np.nansum(pnl))
    trades = int(np.sum(np.abs(np.diff(signals))))

    # RMSE
    rmse = float(np.sqrt(np.mean(np.diff(closes_aligned) ** 2)))

    return {
        "totalProfit": round(total_profit, 2),
        "rmse": round(rmse, 2),
        "trades": trades,
        "strategy": "RSI Divergence (30/70)"
    }


STRATEGIES = {
    "MA Crossover": strategy_ma_crossover,
    "RSI Divergence": strategy_rsi_divergence,
}


# -------------------------------------------------------
# Main Consumer Loop
# -------------------------------------------------------
def run():
    print("[Backtest Consumer] Starting...")

    # MongoDB
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DATABASE]
    print(f"[Backtest Consumer] Connected to MongoDB: {MONGO_DATABASE}")

    # Kafka
    kafka_config = get_kafka_config()

    consumer = KafkaConsumer(
        "binance-backtest-jobs",
        **kafka_config,
        group_id="backtest-consumer-group",
        auto_offset_reset="latest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        consumer_timeout_ms=1000,  # Non-blocking poll
    )

    producer = KafkaProducer(
        **kafka_config,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    )

    print("[Backtest Consumer] Listening on topic 'binance-backtest-jobs'...")

    while True:
        try:
            # Poll for messages
            for message in consumer:
                job = message.value
                # KafkaJS wraps data in a "value" field sometimes
                if isinstance(job, dict) and "value" in job and isinstance(job["value"], str):
                    try:
                        job = json.loads(job["value"])
                    except json.JSONDecodeError:
                        pass

                job_id = job.get("jobId", "unknown")
                symbol = job.get("symbol", "BTCUSDT")
                strategy_name = job.get("strategy", "MA Crossover")

                print(f"\n🔬 [Backtest] Job {job_id}: {symbol} / {strategy_name}")

                try:
                    # Lấy OHLC từ MongoDB (collection OHLC_{SYMBOL} hoặc live_ohlc_1m)
                    collection_name = f"OHLC_{symbol.upper()}"
                    collection = db[collection_name]
                    count = collection.count_documents({})

                    if count == 0:
                        # Thử collection khác
                        collection = db["live_ohlc_1m"]
                        count = collection.count_documents({"symbol": symbol.upper()})

                    print(f"   📊 Found {count} OHLC records in '{collection.name}'")

                    if count < 20:
                        raise ValueError(f"Không đủ dữ liệu OHLC ({count} records). Cần ít nhất 20.")

                    # Lấy data (sort theo timestamp, limit 1000 bản ghi mới nhất)
                    cursor = collection.find(
                        {"symbol": symbol.upper()} if collection.name == "live_ohlc_1m" else {},
                        {"_id": 0, "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1, "timestamp": 1}
                    ).sort("timestamp", -1).limit(1000)

                    ohlc_data = list(cursor)
                    ohlc_data.reverse()  # Oldest first

                    # Chạy strategy
                    strategy_fn = STRATEGIES.get(strategy_name, strategy_ma_crossover)
                    metrics = strategy_fn(ohlc_data)

                    result = {
                        "jobId": job_id,
                        "symbol": symbol,
                        "status": "DONE",
                        "metrics": metrics,
                    }
                    print(f"   ✅ Profit: {metrics['totalProfit']}, RMSE: {metrics['rmse']}, Trades: {metrics['trades']}")

                except Exception as e:
                    print(f"   ❌ Error: {e}")
                    result = {
                        "jobId": job_id,
                        "symbol": symbol,
                        "status": "FAILED",
                        "error": str(e),
                        "metrics": None,
                    }

                # Gửi kết quả về Kafka
                producer.send("binance-backtest-results", value=result)
                producer.flush()
                print(f"   📤 Result sent to 'binance-backtest-results'")

        except Exception as e:
            print(f"[Backtest Consumer] Error in main loop: {e}")
            time.sleep(5)


if __name__ == "__main__":
    run()
