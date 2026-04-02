## SUMARY: 
- 1: Ingest: Connect to Binance WebSocket.

- 2: Buffer: Send raw data to Kafka (crypto-prices topic).

- 3: Process: Consume from Kafka, maybe do some sliding window math in Redis.

- 4: Store: Use the @elastic/elasticsearch client to index the data into Elasticsearch.