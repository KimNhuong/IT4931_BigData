# Project Files & Structure

## Complete File Tree

```
IT4931_BigData/IT4931/
│
├── docker-compose.yml                 ← Main orchestration (7 services)
├── .env.docker                        ← Docker environment variables
│
├── DOCKER_SETUP.md                    ← Comprehensive setup guide
├── IMPLEMENTATION_SUMMARY.md          ← What was built
├── QUICK_REFERENCE.md                 ← Common commands
├── PROJECT_STRUCTURE.md               ← This file
│
├── docker-compose-helper.sh           ← Bash helper (Linux/Mac)
├── docker-compose-helper.ps1          ← PowerShell helper (Windows)
│
└── binance-ingest/
    ├── package.json                   ← Node.js dependencies
    ├── tsconfig.json                  ← TypeScript config
    ├── nest-cli.json                  ← Nest CLI config
    ├── Dockerfile                     ← Multi-stage build ✨ NEW
    ├── .dockerignore                  ← Build optimization ✨ NEW
    │
    ├── .env                           ✨ NEW (pre-configured)
    ├── .env.example                   ✨ NEW (template)
    │
    ├── src/
    │   ├── main.ts                    ← Application entry
    │   ├── app.module.ts              ← Root module
    │   ├── app.controller.ts
    │   ├── app.service.ts
    │   │
    │   ├── kafka/
    │   │   └── kafka.module.ts        ← Kafka consumer setup
    │   │
    │   ├── elastic-search/
    │   │   ├── elastic-search.module.ts
    │   │   ├── elastic-search.controller.ts
    │   │   ├── elastic-search.service.ts
    │   │   └── (empty, ready for implementation)
    │   │
    │   ├── binance/
    │   │   ├── binance.module.ts
    │   │   ├── binance.controller.ts
    │   │   ├── binance.service.ts
    │   │   └── (WebSocket API connection)
    │   │
    │   └── common/
    │       └── (shared utilities ready for implementation)
    │
    ├── dist/                          ← Compiled output
    ├── node_modules/
    ├── test/
    └── README.md

```

## What's New (✨ Marked Above)

### Docker Configuration Files
- **docker-compose.yml**: Complete orchestration with 7 services
- **Dockerfile**: Production-ready multi-stage build
- **.dockerignore**: Optimized build context

### Environment Files
- **.env**: Pre-configured for Docker Compose
- **.env.example**: Template for customization
- **.env.docker**: Root-level Docker variables

### Documentation
- **DOCKER_SETUP.md**: Complete guide (50+ sections)
- **IMPLEMENTATION_SUMMARY.md**: What was built and how
- **QUICK_REFERENCE.md**: Common commands and operations
- **PROJECT_STRUCTURE.md**: This file

### Helper Scripts
- **docker-compose-helper.sh**: Interactive menu for Linux/Mac
- **docker-compose-helper.ps1**: Interactive menu for Windows

## Services & Ports

| Service | Port | Status | Volume | Network |
|---------|------|--------|--------|---------|
| Zookeeper | 2181 | ✅ | None | bigdata-network |
| Kafka | 9092/29092 | ✅ | None | bigdata-network |
| Kafka UI | 8080 | ✅ | None | bigdata-network |
| Elasticsearch | 9200/9300 | ✅ | elasticsearch_data | bigdata-network |
| Kibana | 5601 | ✅ | None | bigdata-network |
| Redis | 6379 | ✅ | redis_data | bigdata-network |
| binance-ingest | 3000 | ✅ | ./src:/app/src | bigdata-network |

## Environment Variables Reference

### Kafka
```env
KAFKA_BROKER=kafka:29092                    # Internal broker address
KAFKA_GROUP_ID=binance-ingest-group         # Consumer group
KAFKA_TOPIC_PRICES=crypto-prices            # Price data topic
KAFKA_TOPIC_OHLC=crypto-ohlc                # Aggregated candles topic
```

### Elasticsearch
```env
ELASTICSEARCH_NODE=http://elasticsearch:9200
ELASTICSEARCH_INDEX_PREFIX=binance
```

### Redis
```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=                             # Empty (development)
```

### Binance
```env
BINANCE_WS_URL=wss://stream.binance.com:9443/ws
BINANCE_SYMBOLS=BTCUSDT,ETHUSDT,BNBUSDT
```

### Application
```env
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
APP_NAME=binance-ingest
AGGREGATION_WINDOW_MS=60000                 # 1 minute window
```

## Module Status

| Module | Status | Purpose |
|--------|--------|---------|
| KafkaModule | ✅ Created | Consumer setup - Ready for implementation |
| ElasticSearchModule | ✅ Created | Indexing service - Ready for implementation |
| BinanceModule | ✅ Created | WebSocket connection - Ready for implementation |
| CommonModule | ✅ Created | Shared utilities - Ready for implementation |

## Next Implementation Steps

### Phase 1: Kafka Consumer (COMPLETE)
- [x] Implement Kafka consumer in KafkaModule
- [x] Subscribe to `crypto-prices` topic
- [x] Parse JSON tick data
- [x] Emit events to aggregation engine

### Phase 2: Aggregation Engine (COMPLETE)
- [x] Implement sliding time window (1-minute)
- [x] Store tick prices in Redis sorted sets
- [x] Calculate OHLC on window boundary
- [x] Publish to `crypto-ohlc` topic

### Phase 3: Elasticsearch Integration (COMPLETE)
- [x] Complete ElasticSearchService implementation
- [x] Create index mapping for OHLC documents
- [x] Implement upsert logic
- [x] Add bulk operations for performance

### Phase 4: API Layer (COMPLETE)
- [x] Create REST endpoints for queries
- [x] Implement WebSocket gateway for live updates
- [x] Add health check endpoint
- [x] Implement pagination and filtering

### Phase 5: Frontend Integration (COMPLETE)
- [x] Connect to REST API (getHistoricalCandles, getSystemHealth)
- [x] Subscribe to WebSocket updates (candle.live, candle.all)
- [x] Render candlestick charts (ECharts Candlestick)
- [x] Show real-time data (MarketOverview ticker flashes)

## Technology Stack Summary

```
├── Runtime: Node.js 20 (Alpine)
├── Framework: Nest.js 11
├── Language: TypeScript 5.7
│
├── Message Broker: Apache Kafka 7.5
├── Coordination: Zookeeper 7.5
│
├── Search & Index: Elasticsearch 8.11
├── Visualization: Kibana 8.11
│
├── Cache & Aggregation: Redis 7 (Alpine)
│
├── Testing: Jest 30
├── Linting: ESLint 9
└── Formatting: Prettier 3.4
```

## Quick Start Checklist

- [ ] Navigate to: `d:\realwork\BigData\IT4931_BigData\IT4931`
- [ ] Run: `docker-compose up -d`
- [ ] Wait: 15 seconds for initialization
- [ ] Verify: `docker-compose ps` (all should be "Up")
- [ ] Access: 
  - Kafka UI: http://localhost:8080
  - Kibana: http://localhost:5601
  - Backend: http://localhost:3000/health
- [ ] Check logs: `docker-compose logs -f`
- [ ] Read: DOCKER_SETUP.md for detailed instructions

## File Size Reference

```
docker-compose.yml            ~3 KB
Dockerfile                    ~1 KB
DOCKER_SETUP.md              ~20 KB
IMPLEMENTATION_SUMMARY.md     ~15 KB
QUICK_REFERENCE.md           ~12 KB
docker-compose-helper.sh     ~10 KB
docker-compose-helper.ps1    ~12 KB
```

## Health Check Endpoints

```bash
# Elasticsearch
GET http://localhost:9200/_cluster/health

# Kibana
GET http://localhost:5601/api/status

# Redis
docker-compose exec redis redis-cli ping

# Nest Backend
GET http://localhost:3000/health

# Kafka (via docker-compose)
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

## Production Considerations

| Item | Development | Production |
|------|-------------|-----------|
| Elasticsearch Heap | 512MB | 4GB+ |
| Kafka Replication | 1 | 3+ |
| Redis Persistence | AOF | RDB + AOF |
| Security | Disabled | Enabled |
| Monitoring | None | Prometheus + Alerting |
| Logging | Docker logs | ELK Stack |
| Backups | None | Daily snapshots |
| SSL/TLS | None | Required |

## Troubleshooting Quick Links

See **DOCKER_SETUP.md** sections:
- "Services fail to start"
- "Elasticsearch errors"
- "Kafka connection issues"  
- "Nest.js fails to build"

See **QUICK_REFERENCE.md** for:
- Database operations
- Debugging commands
- Monitoring and performance tuning

---

**Project Status**: ✅ Infrastructure Complete - Ready for Application Development  
**Setup Time**: ~5 minutes  
**Storage Used**: ~3-4 GB (varies with data)  
**Last Updated**: 2025-04-02
