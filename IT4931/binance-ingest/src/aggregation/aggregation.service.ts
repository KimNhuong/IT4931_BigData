import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TickData, IAggregationService } from './aggregation.consumer';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface OhlcCandle {
  symbol: string;
  open: string;
  high: string;
  low: string;
  close: string;
  startTime: number;
  endTime: number;
}

@Injectable()
export class AggregationService implements IAggregationService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AggregationService.name);
  private redisClient: Redis;
  private currentWindowStart: number | null = null;
  private readonly windowSizeMs = 60000; // 1 phút (60,000 ms)

  constructor(private eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
    this.logger.log('Connected to Redis for Aggregation Engine');
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.quit();
    }
  }

  async processTick(data: TickData): Promise<void> {
    try {
      const timestamp = Number(data.timestamp);
      const windowStart = Math.floor(timestamp / this.windowSizeMs) * this.windowSizeMs;
      const redisKey = `binance:ticks:${data.symbol}`;

      // 1. Lưu tick vào Redis Sorted Set (Score = timestamp)
      const member = JSON.stringify(data);
      await this.redisClient.zadd(redisKey, timestamp, member);

      // Nếu đây là tick đầu tiên, khởi tạo biến theo dõi
      if (this.currentWindowStart === null) {
        this.currentWindowStart = windowStart;
        return;
      }

      // 2. Kiểm tra ranh giới cửa sổ: Nếu tick rơi vào phút MỚI (windowStart > currentWindowStart)
      if (windowStart > this.currentWindowStart) {
        // Có nghĩa là cửa sổ phút TRƯỚC ĐÓ đã đóng. Ta sẽ tính OHLC cho nó.
        const closedWindowStart = this.currentWindowStart;
        const closedWindowEnd = closedWindowStart + this.windowSizeMs - 1;

        // Lấy tất cả các tick trong khoảng phút đó
        const rawTicks = await this.redisClient.zrangebyscore(
          redisKey,
          closedWindowStart,
          closedWindowEnd
        );

        if (rawTicks.length > 0) {
          const ticks: TickData[] = rawTicks.map((t) => JSON.parse(t));
          
          // Tính toán OHLC
          const open = ticks[0].price; // Tick sớm nhất
          const close = ticks[ticks.length - 1].price; // Tick muộn nhất
          const high = Math.max(...ticks.map(t => parseFloat(t.price))).toString();
          const low = Math.min(...ticks.map(t => parseFloat(t.price))).toString();

          const candle: OhlcCandle = {
            symbol: data.symbol,
            open,
            high,
            low,
            close,
            startTime: closedWindowStart,
            endTime: closedWindowEnd
          };

          // 3. Phát sự kiện nội bộ chứa nến OHLC đã tính xong
          this.eventEmitter.emit('candle.created', candle);
          this.logger.log(`[OHLC] Generated 1m candle for ${data.symbol}: O=${open} H=${high} L=${low} C=${close}`);

          // Dọn dẹp Redis: Xoá các tick cũ để giải phóng bộ nhớ
          await this.redisClient.zremrangebyscore(redisKey, '-inf', closedWindowEnd);
        }

        // Cập nhật cửa sổ hiện tại sang phút mới
        this.currentWindowStart = windowStart;
      }

    } catch (error) {
      this.logger.error('Error in sliding window aggregation', error);
    }
  }
}
