# 8 Symbols Task Assignment - Developer Guidance

## Task Distribution - 5 Symbols

| member | Symbol | Topic | WebSocket Stream |
|-----|--------|-------|------------------|
| member 1  | BTCUSDT | `crypto-prices-btcusdt` | `btcusdt@ticker` |
| member 2 | ETHUSDT | `crypto-prices-ethusdt` | `ethusdt@ticker` |
| member 3 | BNBUSDT | `crypto-prices-bnbusdt` | `bnbusdt@ticker` |
| member 4 | ADAUSDT | `crypto-prices-adausdt` | `adausdt@ticker` |
| member 5 | XRPUSDT | `crypto-prices-xrpusdt` | `xrpusdt@ticker` |


---

## Hướng dẫn cho mỗi member

### 1. Update `.env` file

File: `binance-ingest/.env`

```env
# Kafka Configuration
KAFKA_BROKER=kafka:29092
KAFKA_GROUP_ID=binance-ingest-group

# ASSIGNMENT: member N - Symbol XXXUSDT
KAFKA_TOPIC_SYMBOL=crypto-prices-XXXUSDT  # Replace XXXUSDT with your symbol
BINANCE_SYMBOL=XXXUSDT

# Elasticsearch Configuration
ELASTICSEARCH_NODE=http://elasticsearch:9200

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
```

### 2. Tạo Service

File: `src/symbols/{SYMBOL}/symbol.service.ts`

```typescript
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { WebSocket } from 'ws';

const SYMBOL = process.env.BINANCE_SYMBOL;
const TOPIC = process.env.KAFKA_TOPIC_SYMBOL;

@Injectable()
export class SymbolService implements OnModuleInit {
    private ws!: WebSocket;

    constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {}

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(TOPIC);
        this.initWebSocket();
    }

    initWebSocket() {
        const endpoint = `wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@ticker`;
        this.ws = new WebSocket(endpoint);

        this.ws.on('message', (data) => {
            const rawData = JSON.parse(data.toString());
            
            const priceUpdate = {
                symbol: rawData.s,
                price: rawData.c,
                timestamp: rawData.E,
            };

            this.kafkaClient.emit(TOPIC, priceUpdate);
            console.log(`[${SYMBOL}] sent to kafka: ${priceUpdate.symbol} - ${priceUpdate.price}`);
        });

        this.ws.on('error', (error) => {
            console.error(`[${SYMBOL}] socket error:`, error);
            setTimeout(() => this.initWebSocket(), 5000);
        });

        this.ws.on('close', () => {
            console.log(`[${SYMBOL}] socket closed, reconnecting...`);
            setTimeout(() => this.initWebSocket(), 5000);
        });
    }
}
```

### 3. Tạo Controller

File: `src/symbols/{SYMBOL}/symbol.controller.ts`

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

const TOPIC = process.env.KAFKA_TOPIC_SYMBOL;

@Controller()
export class SymbolController {
    @EventPattern(TOPIC)
    handlePrice(@Payload() data: any) {
        console.log(`[Price Update] ${data.symbol}: ${data.price}`);
    }
}
```

### 4. Tạo Module

File: `src/symbols/{SYMBOL}/symbol.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { SymbolService } from './symbol.service';
import { SymbolController } from './symbol.controller';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
    imports: [KafkaModule],
    providers: [SymbolService],
    controllers: [SymbolController],
})
export class SymbolModule {}
```

---

## Update app.module.ts (Main Team)

```typescript
import { Module } from '@nestjs/common';
import { KafkaModule } from './kafka/kafka.module';
import { BtcusdtModule } from './symbols/btcusdt/symbol.module';
import { EthusdtModule } from './symbols/ethusdt/symbol.module';
import { BnbusdtModule } from './symbols/bnbusdt/symbol.module';
import { AdausdtModule } from './symbols/adausdt/symbol.module';
import { XrpusdtModule } from './symbols/xrpusdt/symbol.module';
import { DogusdtModule } from './symbols/dogeusdt/symbol.module';
import { LtcusdtModule } from './symbols/ltcusdt/symbol.module';
import { SolusdtModule } from './symbols/solusdt/symbol.module';

@Module({
    imports: [
        KafkaModule,
        BtcusdtModule,
        EthusdtModule,
        BnbusdtModule,
        AdausdtModule,
        XrpusdtModule,
        DogusdtModule,
        LtcusdtModule,
        SolusdtModule,
    ],
})
export class AppModule {}
```

---

## Testing

### 1. Kiểm tra Kafka UI
- Open: http://localhost:8080
- Xem topic của symbol mình: `crypto-prices-XXXUSDT`

### 2. Kiểm tra logs
```bash
docker-compose logs -f binance-ingest | grep XXXUSDT
```

### 3. Kiểm tra topic trong Kafka UI
- Navigate to Topics
- Search for `crypto-prices-XXXUSDT`
- Check messages in real-time

---

## Git Workflow

```bash
# Clone và setup
git clone <repo>
cd IT4931

# Tạo branch cho symbol của bạn
git checkout -b feature/symbol-XXXUSDT

# Làm công việc
# ... code ...

# Commit
git add .
git commit -m "feat: add XXXUSDT symbol handler"

# Push
git push origin feature/symbol-XXXUSDT

# Tạo Pull Request trên GitHub/GitLab
# → Assign reviewer
# → Merge sau khi approved
```

---

## Checklist cho mỗi member

- [ ] Update `.env` file với symbol của bạn
- [ ] Tạo folder `src/symbols/{SYMBOL}/`
- [ ] Tạo `symbol.service.ts`
- [ ] Tạo `symbol.controller.ts`
- [ ] Tạo `symbol.module.ts`
- [ ] Test WebSocket connection tới Binance
- [ ] Verify topic được tạo trong Kafka
- [ ] Check logs không có error
- [ ] Commit và push code
- [ ] Create Pull Request

---

## Troubleshooting

### Issue: Topic không xuất hiện trong Kafka UI
**Solution:** Chờ container khởi động đầy đủ (30-60 giây) hoặc emit message đầu tiên

### Issue: WebSocket connection fails
**Solution:** Kiểm tra internet connection, verify Binance API endpoint hoạt động

### Issue: Kafka connection error
**Solution:** 
```bash
docker-compose logs kafka
docker-compose ps  # Verify kafka is UP
```

### Issue: Env variables không được load
**Solution:**
```bash
docker-compose down
docker-compose up --build
```

---

## Support

- 📚 Reference: [Binance WebSocket API Docs](https://developers.binance.com/docs/binance-trading-api/websocket_market_streams)
