# Sử dụng Bitnami Spark (Đã có sẵn Java & Python)
FROM bitnamilegacy/spark:3.4.1

USER root

# 1. Cài đặt Node.js để chạy Backend NestJS
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 2. Build Backend (binance-ingest)
WORKDIR /app/backend
COPY IT4931/binance-ingest/package*.json ./
RUN npm install
COPY IT4931/binance-ingest/ .
RUN npm run build

# 3. Chuẩn bị Spark Processing
WORKDIR /app/spark
COPY IT4931/spark-processing/ .
RUN pip install pyspark kafka-python pymongo numpy

# 4. Cấu hình Port cho Hugging Face (Phải là 7860)
ENV PORT=7860
EXPOSE 7860

# 5. Script khởi chạy song song cả 2 dịch vụ
RUN echo '#!/bin/bash' > /app/run.sh && \
    echo 'echo "Starting NestJS Backend..."' >> /app/run.sh && \
    echo 'cd /app/backend && node dist/main.js &' >> /app/run.sh && \
    echo 'echo "Starting Backtest Consumer..."' >> /app/run.sh && \
    echo 'cd /app/spark && python streaming/backtest_consumer.py &' >> /app/run.sh && \
    echo 'echo "Starting Spark Streaming..."' >> /app/run.sh && \
    echo 'cd /app/spark && spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.1,org.apache.hadoop:hadoop-aws:3.3.4,com.amazonaws:aws-java-sdk-bundle:1.12.262,org.mongodb.spark:mongo-spark-connector_2.12:10.2.1 --master local[*] streaming/ohlc_aggregator.py' >> /app/run.sh
RUN chmod +x /app/run.sh

CMD ["/app/run.sh"]
