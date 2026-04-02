# Docker Compose Setup - Binance Big Data Pipeline

This docker-compose configuration sets up a complete real-time crypto data pipeline with Kafka, Elasticsearch, Redis, and a Nest.js backend service.

## Services

### Core Services

| Service | Port | Purpose |
|---------|------|---------|
| **Zookeeper** | 2181 | Kafka coordination and cluster management |
| **Kafka** | 9092 | Message broker for data streams |
| **Kafka UI** | 8080 | Visual Kafka management interface |
| **Elasticsearch** | 9200 | Data indexing and search engine |
| **Kibana** | 5601 | Elasticsearch visualization dashboard |
| **Redis** | 6379 | Caching and sliding window aggregation |
| **binance-ingest** | 3000 | Nest.js backend service |

## Prerequisites

- Docker & Docker Compose installed
- At least 4GB RAM available
- Windows/Linux/Mac with Docker Desktop

## Quick Start

### 1. Start all services

```bash
cd d:\realwork\BigData\IT4931_BigData\IT4931
docker-compose up -d
```

### 2. Verify all services are running

```bash
docker-compose ps
```

Expected output:
```
NAME                 STATUS              PORTS
zookeeper            Up (healthy)        2181/tcp
kafka                Up (healthy)        9092/tcp, 9101/tcp
kafka-ui             Up                   0.0.0.0:8080->8080/tcp
elasticsearch        Up (healthy)        0.0.0.0:9200->9200/tcp, 9300/tcp
kibana               Up (healthy)        0.0.0.0:5601->5601/tcp
redis                Up (healthy)        0.0.0.0:6379->6379/tcp
binance-ingest       Up                   0.0.0.0:3000->3000/tcp
```

### 3. Access the interfaces

- **Kafka UI**: http://localhost:8080
- **Elasticsearch**: http://localhost:9200
- **Kibana**: http://localhost:5601
- **Nest.js API**: http://localhost:3000
- **Redis CLI**: `docker-compose exec redis redis-cli`

## Service Details

### Kafka Configuration

- **Broker**: `kafka:29092` (internal), `localhost:9092` (external)
- **Default Topics**: `crypto-prices`, `crypto-ohlc` (auto-created)
- **Replication Factor**: 1 (suitable for development)

### Elasticsearch Configuration

- **Security**: Disabled (development only)
- **Memory**: 512MB heap
- **Index Prefix**: `binance`
- **Data Persistence**: Stored in `elasticsearch_data` volume

### Redis Configuration

- **Persistence**: AOF (Append-Only File) enabled
- **Default DB**: 0
- **Data Persistence**: Stored in `redis_data` volume

### Nest.js Backend

- **Environment**: development (hot-reload enabled)
- **Build Context**: `./binance-ingest`
- **Watch Mode**: Enabled for source files
- **Health Check**: Available at `/health` endpoint

## Common Commands

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f binance-ingest
docker-compose logs -f elasticsearch
docker-compose logs -f kafka
```

### Stop all services

```bash
docker-compose down
```

### Stop services but keep volumes (data persistence)

```bash
docker-compose down
```

### Remove all services AND volumes (cleanup everything)

```bash
docker-compose down -v
```

### Rebuild services (after code changes)

```bash
docker-compose up -d --build
```

### Access Kafka via CLI

```bash
# List topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Create topic
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic test-topic --partitions 1 --replication-factor 1

# Consume messages
docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic crypto-prices --from-beginning
```

### Access Redis CLI

```bash
docker-compose exec redis redis-cli

# Check keys
> KEYS *

# Monitor live activity
> MONITOR

# Get key info
> INFO
```

### Access Elasticsearch

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health

# List indices
curl http://localhost:9200/_cat/indices

# Search documents
curl http://localhost:9200/binance*/_search
```

## Environment Variables

Create a `.env` file in the `binance-ingest` directory with:

```env
NODE_ENV=development
KAFKA_BROKER=kafka:29092
ELASTICSEARCH_NODE=http://elasticsearch:9200
REDIS_HOST=redis
REDIS_PORT=6379
```

See `binance-ingest/.env.example` for all available options.

## Architecture Flow

```
┌─────────────┐
│ Binance API │
└──────┬──────┘
       │ WebSocket (tick data)
       ▼
┌──────────────────┐
│  Kafka Producer  │ (Python/external script)
└──────┬───────────┘
       │ Publish to topic
       ▼
┌──────────────────────────┐
│ Kafka Topic (crypto-prices) │
└──────┬───────────────────┘
       │ Subscribe
       ▼
┌─────────────────────────────┐
│  Nest.js Backend            │
│  - Kafka Consumer           │
│  - Aggregation Engine       │
│  - Redis Sliding Window     │
└──────┬──────────────────────┘
       │ Compute OHLC
       ▼
┌──────────────┐    ┌─────────────┐
│ Elasticsearch│    │    Redis    │
│  (Storage)   │    │   (Cache)   │
└──────┬───────┘    └────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Frontend Dashboard (React)  │
│  - REST API queries          │
│  - WebSocket real-time push  │
│  - Candlestick charts        │
└──────────────────────────────┘
```

## Troubleshooting

### Services fail to start

1. **Check available ports**: Ensure ports 2181, 9092, 8080, 9200, 5601, 6379, 3000 are available
2. **Check disk space**: Docker needs space for volumes
3. **Increase Docker memory**: Allocate at least 4GB RAM to Docker

### Elasticsearch errors

```bash
# Reset Elasticsearch data
docker-compose down -v elasticsearch
docker-compose up -d elasticsearch
```

### Kafka connection issues

```bash
# Check Kafka logs
docker-compose logs kafka

# Restart Kafka and Zookeeper
docker-compose restart zookeeper kafka
```

### Nest.js fails to build

```bash
# Clear Docker cache and rebuild
docker-compose down
docker system prune
docker-compose up --build -d
```

## Production Deployment

For production deployment:

1. Enable Elasticsearch security (X-Pack)
2. Set `NODE_ENV=production`
3. Increase Elasticsearch heap to 2GB+
4. Configure Kafka replication factor to 3+
5. Use managed services (AWS, GCP, Azure) instead of Docker
6. Set up proper monitoring and logging
7. Enable Redis password authentication
8. Configure SSL/TLS for all services

## Development vs Production

### Development (current setup)
- Security disabled (fast iteration)
- Single broker/node setup
- In-container hot-reload
- Suitable for testing

### Production
- Enable authentication and encryption
- Multi-node redundancy
- Persistent volumes on managed storage
- Load balancers and reverse proxies
- Monitoring and alerting (Prometheus, ELK)

## Next Steps

1. Implement Kafka Producer (connects to Binance WebSocket API)
2. Implement Nest.js Kafka Consumer service
3. Build aggregation engine with Redis sliding windows
4. Create REST API endpoints for queries
5. Develop WebSocket gateway for real-time updates
6. Build React/Vue frontend dashboard

## Resources

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Apache Kafka](https://kafka.apache.org/)
- [Elasticsearch](https://www.elastic.co/)
- [Redis](https://redis.io/)
- [Nest.js](https://docs.nestjs.com/)
- [Kibana](https://www.elastic.co/kibana)
