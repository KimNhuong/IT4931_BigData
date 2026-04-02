# Quick Reference Guide

## Start/Stop Operations

```bash
# Start all services
docker-compose up -d

# Stop all services (keep data)
docker-compose stop

# Remove containers (keep data)
docker-compose down

# Nuke everything (remove containers & volumes)
docker-compose down -v

# Restart services
docker-compose restart

# Rebuild and start
docker-compose up -d --build
```

## View Status & Logs

```bash
# Show service status
docker-compose ps

# View all logs (live)
docker-compose logs -f

# View specific service logs
docker-compose logs -f elasticsearch
docker-compose logs -f kafka
docker-compose logs -f binance-ingest
docker-compose logs -f redis

# View last 50 lines
docker-compose logs --tail=50

# View logs with timestamps
docker-compose logs -f --timestamps
```

## Kafka Operations

```bash
# List all topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Create a topic
docker-compose exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --create \
  --topic crypto-prices \
  --partitions 3 \
  --replication-factor 1

# Delete a topic
docker-compose exec kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --delete \
  --topic crypto-prices

# Consume messages from topic (from beginning)
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic crypto-prices \
  --from-beginning

# Consume messages from topic (only new)
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic crypto-prices

# Produce test message
docker-compose exec kafka kafka-console-producer \
  --broker-list localhost:9092 \
  --topic crypto-prices

# View consumer groups
docker-compose exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --list

# View consumer group details
docker-compose exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group binance-ingest-group \
  --describe
```

## Redis Operations

```bash
# Enter Redis CLI
docker-compose exec redis redis-cli

# Inside Redis CLI:
# Ping redis
PING

# List all keys
KEYS *

# Get specific key
GET mykey

# Set key
SET mykey "value"

# List all keys matching pattern
KEYS "crypto-*"

# Delete key
DEL mykey

# View database stats
INFO

# View memory usage
INFO memory

# Monitor all commands (real-time)
MONITOR

# Flush database
FLUSHDB

# Exit CLI
EXIT
```

## Elasticsearch Operations

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health | json_pp

# List all indices
curl http://localhost:9200/_cat/indices

# View index details
curl http://localhost:9200/_cat/indices/binance-ohlc

# Search documents in index
curl http://localhost:9200/binance-ohlc/_search -H "Content-Type: application/json" -d '
{
  "query": {
    "match_all": {}
  },
  "size": 10
}
'

# Delete index
curl -X DELETE http://localhost:9200/binance-ohlc

# Create index with mapping
curl -X PUT http://localhost:9200/binance-ohlc -H "Content-Type: application/json" -d '
{
  "mappings": {
    "properties": {
      "timestamp": {"type": "date"},
      "symbol": {"type": "keyword"},
      "open": {"type": "double"},
      "high": {"type": "double"},
      "low": {"type": "double"},
      "close": {"type": "double"}
    }
  }
}
'

# Get document count
curl http://localhost:9200/binance-ohlc/_count

# View cluster stats
curl http://localhost:9200/_stats
```

## Backend Service Operations

```bash
# View backend logs
docker-compose logs -f binance-ingest

# Check backend health
curl http://localhost:3000/health

# Execute command in backend container
docker-compose exec binance-ingest npm run build

# Enter backend container shell
docker-compose exec binance-ingest /bin/sh

# View incoming request logs
docker-compose logs -f binance-ingest | grep "GET\|POST\|PUT\|DELETE"
```

## Debugging

```bash
# Inspect service configuration
docker-compose config

# Validate docker-compose file
docker-compose config --quiet

# View environment variables in service
docker-compose exec binance-ingest env

# Check network connectivity
docker-compose exec binance-ingest ping elasticsearch
docker-compose exec binance-ingest ping kafka
docker-compose exec binance-ingest ping redis

# Check DNS resolution
docker-compose exec binance-ingest nslookup elasticsearch
docker-compose exec binance-ingest nslookup kafka

# View Docker network
docker network ls
docker network inspect bigdata-network
```

## Performance & Monitoring

```bash
# Check resource usage (real-time)
docker stats

# Check resource usage for specific service
docker stats binance-ingest elasticsearch redis

# View container processes
docker-compose exec binance-ingest ps aux
docker-compose exec elasticsearch ps aux

# Check disk usage
docker system df

# Remove unused images/containers
docker system prune
docker system prune -a  # More aggressive

# View container info
docker inspect binance-ingest
docker inspect elasticsearch
docker inspect redis
```

## Common Troubleshooting Commands

```bash
# Service won't start - check logs
docker-compose logs elasticsearch
docker-compose logs kafka

# Port conflict - find what's using port 9200
netstat -ano | findstr :9200  # Windows
lsof -i :9200  # Linux/Mac

# Elasticsearch health check
curl http://localhost:9200/_cluster/health

# Redis connectivity
docker-compose exec binance-ingest redis-cli -h redis ping

# Kafka connectivity from app
docker-compose exec binance-ingest nc -zv kafka 29092

# Clear all Docker state
docker system prune -a --volumes

# Rebuild fresh
docker-compose down -v
docker-compose up -d --build
```

## Production Checklist

```bash
# Before going live:

# 1. Set NODE_ENV=production
# 2. Disable security bypass in Elasticsearch
# 3. Set Elasticsearch replication-factor to 3+
# 4. Enable Redis password
# 5. Configure persistent volumes for production storage
# 6. Set up log aggregation (ELK stack)
# 7. Configure monitoring (Prometheus)
# 8. Set up backups for Elasticsearch and Redis
# 9. Configure firewall rules
# 10. Enable Kafka replication-factor to 3
# 11. Set up monitoring dashboards
# 12. Configure alerts
# 13. Load test the infrastructure
# 14. Document runbooks
```

## Useful Aliases (Linux/Mac)

```bash
# Add to ~/.bashrc or ~/.zshrc

alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcexec='docker-compose exec'

# Then use:
dc ps
dcup
dclogs elasticsearch
```

## Useful PowerShell Functions (Windows)

```powershell
# Add to PowerShell profile

function Start-Services { docker-compose up -d }
function Stop-Services { docker-compose down }
function View-Logs { docker-compose logs -f @args }
function Check-Status { docker-compose ps }
function Restart-Services { docker-compose restart @args }

# Then use:
Check-Status
Start-Services
View-Logs elasticsearch
```

---

**Tip**: Bookmark this file for quick reference!  
**Last Updated**: 2025-04-02
