import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient!: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = Number(this.configService.get<number>('REDIS_PORT') || 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    console.log(`[RedisService] Connecting to Redis at ${host}:${port}...`);
    this.redisClient = new Redis({
      host,
      port,
      password,
      keyPrefix: 'binance:',
    });

    this.redisClient.on('connect', () => {
      console.log('[RedisService] Connected to Redis successfully');
    });

    this.redisClient.on('error', (err) => {
      console.error('[RedisService] Redis connection error:', err);
    });
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  // General Key-Value caching
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redisClient.set(key, stringValue, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, stringValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  // List operations for OHLC candles cache
  async pushToList(key: string, value: any, maxLength: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    // Push new candle to the end of list (right side)
    await this.redisClient.rpush(key, stringValue);
    // Trim list to keep only the last N items (e.g. last 200 candles)
    await this.redisClient.ltrim(key, -maxLength, -1);
  }

  async getList<T>(key: string): Promise<T[]> {
    const list = await this.redisClient.lrange(key, 0, -1);
    return list.map(item => JSON.parse(item) as T);
  }

  async setList(key: string, values: any[]): Promise<void> {
    // Pipeline to execute atomic overwrite
    const pipeline = this.redisClient.pipeline();
    pipeline.del(key);
    for (const val of values) {
      pipeline.rpush(key, JSON.stringify(val));
    }
    await pipeline.exec();
  }

  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}
