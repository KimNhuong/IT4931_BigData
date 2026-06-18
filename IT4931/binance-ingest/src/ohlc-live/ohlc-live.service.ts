import { Injectable, OnModuleInit } from '@nestjs/common';
import { OhlcLiveGateway } from './ohlc-live.gateway';
import { MongoClient } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OhlcLiveService implements OnModuleInit {
  private mongoClient: MongoClient;
  private dbName: string = 'binance';

  constructor(
    private readonly ohlcGateway: OhlcLiveGateway,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const mongoUri =
      this.configService.get<string>('MONGODB_URI') ||
      'mongodb://mongodb:27017/binance';
    this.mongoClient = new MongoClient(mongoUri);
  }

  async onModuleInit() {
    try {
      await this.mongoClient.connect();
      console.log('[MongoDB] Connected successfully for historical data');
    } catch (err) {
      console.error('[MongoDB] Connection failed:', err);
    }
  }

  async getHistoricalOHLC(symbol: string) {
    const redisKey = `ohlc_recent:${symbol.toUpperCase()}`;
    try {
      // Try to get from Redis Cache first
      const cachedCandles = await this.redisService.getList<any>(redisKey);
      if (cachedCandles && cachedCandles.length > 0) {
        console.log(`[Redis Cache] Hit: Fetched ${cachedCandles.length} historical candles for ${symbol}`);
        return cachedCandles;
      }
    } catch (redisErr) {
      console.warn(`[Redis Cache] Error fetching list for ${symbol}, falling back to MongoDB:`, redisErr);
    }

    // Fallback to MongoDB
    try {
      console.log(`[MongoDB] Cache miss: Fetching historical data from DB for ${symbol}`);
      const db = this.mongoClient.db(this.dbName);
      const collectionName = `OHLC_${symbol.toUpperCase()}`;
      const collection = db.collection(collectionName);

      const candles = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(200)
        .toArray();

      const sortedCandles = candles.reverse();

      // Populate Redis Cache asynchronously
      if (sortedCandles.length > 0) {
        this.redisService.setList(redisKey, sortedCandles).catch(err => {
          console.error('[Redis Cache] Failed to populate list:', err);
        });
      }

      return sortedCandles;
    } catch (err) {
      console.error(
        `[MongoDB] Error fetching historical data for ${symbol}:`,
        err,
      );
      return [];
    }
  }

  async handleIncomingOhlc(data: any) {
    const symbol = data.symbol;

    // --- STEP 1: CACHING METHOD (REDIS) ---
    try {
      const redisKey = `ohlc_recent:${symbol.toUpperCase()}`;
      // Push new candle to redis list, keeping max 200 items
      await this.redisService.pushToList(redisKey, data, 200);
    } catch (err) {
      console.error('[Redis Cache] Failed to update recent candles:', err);
    }

    // --- STEP 2: FLOW TO FRONTEND (WEBSOCKETS) ---
    this.ohlcGateway.broadcastCandle(symbol, data);

    console.log(`[Service] Processed and Broadcasted real-time candle for ${symbol} - Open: ${data.open}, High: ${data.high}, Low: ${data.low}, Close: ${data.close}, Vol: ${data.volume}`);
  }

  async handleIncomingTick(data: any) {
    const symbol = data.symbol;
    this.ohlcGateway.broadcastTick(symbol, data);
    console.log(`[Service] Broadcasted real-time tick for ${symbol} - Price: ${data.price}, Vol: ${data.volume}`);
  }

  async handleIncomingWhaleAlert(data: any) {
    const symbol = data.symbol;
    this.ohlcGateway.broadcastWhaleAlert(symbol, data);
    console.log(`[Service] 🐳 WHALE ALERT broadcasted for ${symbol} - Price: ${data.price}, Vol: ${data.volume}`);
  }
}
