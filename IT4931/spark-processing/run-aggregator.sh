#!/bin/bash
spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,org.mongodb.spark:mongo-spark-connector_2.12:10.3.0 \
  --jars /app/jars/hadoop-aws-3.3.4.jar,/app/jars/aws-java-sdk-bundle-1.12.262.jar \
  --conf spark.driver.extraClassPath=/app/jars/hadoop-aws-3.3.4.jar:/app/jars/aws-java-sdk-bundle-1.12.262.jar \
  --conf spark.executor.extraClassPath=/app/jars/hadoop-aws-3.3.4.jar:/app/jars/aws-java-sdk-bundle-1.12.262.jar \
  /app/streaming/ohlc_aggregator.py

#run cmd:  docker exec -it spark-master /app/run-aggregator.sh --> Muốn spark thực thi lệnh thì 
# bao ai gen lenh, lay file sau day de chay script: wget
# spark-processing\jars\aws-java-sdk-bundle-1.12.262.jar
# spark-processing\jars\hadoop-aws-3.3.4.jar 

# Mở một terminal mới và chạy:

#   1 docker exec -it spark-master spark-submit `
#   2   --master "local[*]" `
#   3   --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,org.apache.hadoop:hadoop-aws:3.3.4 `
#   4   /app/batch/backtest_job_consumer.py