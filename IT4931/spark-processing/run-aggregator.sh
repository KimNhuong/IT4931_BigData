#!/bin/bash
spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0,org.mongodb.spark:mongo-spark-connector_2.12:10.3.0 \
  /app/streaming/ohlc_aggregator.py

#run cmd:  docker exec -it spark-master /app/run-aggregator.sh 