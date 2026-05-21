# Project Files & Structure

## Complete File Tree (Phase 2 Target)

```
IT4931_BigData/IT4931/
│
├── docker-compose.yml                 ← Orchestration (Expanded for Spark/Mongo)
├── .env.docker                        ← Docker environment variables
│
├── binance-ingest/                    ← NestJS Ingestion & API Service
│   ├── src/
│   │   ├── binance/                   ← WebSocket Streamer
│   │   ├── kafka/                     ← Kafka Producers/Consumers
│   │   ├── elastic-search/            ← Aggregated Data Indexing
│   │   ├── backtest/                  ✨ NEW: Backtest Job Orchestration
│   │   └── websocket/                 ✨ NEW: Real-time Dashboard Gateway
│
├── spark-processing/                  ✨ NEW: Spark Logic
│   ├── streaming/                     ← Structured Streaming (OHLC, Alerts)
│   ├── batch/                         ← Batch Jobs (Backtesting)
│   ├── jars/                          ← Kafka & MongoDB Connectors
│   └── Dockerfile.spark               ← Spark cluster configuration
│
├── dashboard/                         ✨ NEW: Frontend Application
│   ├── src/
│   │   ├── components/                ← Charts, Whale Alert Feed
│   │   └── hooks/                     ← WebSocket subscriptions
│   └── package.json
│
└── docs/                              ← Project Documentation
    ├── phase-1/
    ├── phase-2/
    │   ├── CONTEXT.md                 ← Phase 2 Technical Specs
    │   └── TEAM_TASK_DIVISION.md      ← 5-person Work Plan
    ├── IMPLEMENTATION_SUMMARY.md
    └── PROJECT_STRUCTURE.md
```

## Services & Infrastructure

| Service | Port | Role | Status |
|---------|------|------|--------|
| Kafka | 9092 | Message Backbone | ✅ Up |
| Elasticsearch | 9200 | Search & Hot Storage | ✅ Up |
| Redis | 6379 | Real-time Cache | ✅ Up |
| Nest Backend | 3000 | Ingestion & Orchestration | ✅ Up |
| **MongoDB** | 27017 | **Historical Data Lake** | 🚀 Planned |
| **Spark Master**| 7077 | **Compute Cluster** | 🚀 Planned |
| **Dashboard** | 5173 | **User Interface** | 🚀 Planned |

## Module Status (Phase 2)

| Module | Status | Purpose |
|--------|--------|---------|
| BinanceModule | ✅ Implemented | WebSocket connection to Binance |
| KafkaModule | ✅ Implemented | Internal event messaging |
| **SparkStream** | 🚀 In Progress | Real-time OHLC & Whale Alerts |
| **SparkBatch** | 🚀 Planned | Historical Backtesting logic |
| **MongoModule** | 🚀 Planned | Persistence for raw historical ticks |
| **Dashboard** | 🚀 Planned | React-based real-time visualization |

## Next Implementation Steps (Phase 2)

### 1. Data Lake Setup
- [ ] Add MongoDB to `docker-compose.yml`
- [ ] Implement data persistence from `binance-raw-ticks` to MongoDB.
- [ ] Verify data integrity for millions of records.

### 2. Spark Streaming Development
- [ ] Set up Spark cluster in Docker.
- [ ] Implement Structured Streaming from Kafka.
- [ ] Apply 1m/5m windowing for OHLC.
- [ ] Implement sliding window logic for volume-based "Whale Alerts".

### 3. Spark Batch & Backtesting
- [ ] Implement Spark Batch jobs to query MongoDB.
- [ ] Build strategy engine (e.g., Moving Average Cross).
- [ ] Integrate with Kafka for job status updates.

### 4. Real-time Dashboard
- [ ] Build React/Vite dashboard.
- [ ] Integrate Lightweight Charts or TradingView.
- [ ] Implement WebSocket connection to NestJS for real-time updates.

---

**Project Status**: 🔄 Phase 2 Infrastructure & Processing in Development  
**Last Updated**: 2026-05-21
