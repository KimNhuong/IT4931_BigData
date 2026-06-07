import { Injectable } from '@nestjs/common';
import { OhlcLiveGateway } from './ohlc-live.gateway';
// import { InjectRedis } from '@liaoliaots/nestjs-redis'; // Nếu dùng thư viện nestjs-redis
// import Redis from 'ioredis';

@Injectable()
export class OhlcLiveService {
  constructor(
    // private readonly redis: Redis, // Inject Redis instance vào đây khi bạn cấu hình module Redis
    private readonly ohlcGateway: OhlcLiveGateway,
  ) {}

  async handleIncomingOhlc(data: any) {
    const symbol = data.symbol;

    // --- STEP 1: CACHING METHOD (REDIS) ---
    // Đẩy nến mới vào đầu danh sách (LPUSH) và cắt tỉa (LTRIM) để chỉ giữ đúng 200 nến mới nhất
    try {
      const redisKey = `ohlc_recent:${symbol.toUpperCase()}`;
      // await this.redis.lpush(redisKey, JSON.stringify(data));
      // await this.redis.ltrim(redisKey, 0, 199); 
    } catch (err) {
      console.error('[Redis Cache] Failed to update recent candles:', err);
    }

    // --- STEP 2: FLOW TO FRONTEND (WEBSOCKETS) ---
    // Gọi Gateway chuyển tiếp cây nến này đến các User đang join room của coin này
    this.ohlcGateway.broadcastCandle(symbol, data);
    
    console.log(`[Service] Processed and Broadcasted real-time candle for ${symbol}`);
  }
}