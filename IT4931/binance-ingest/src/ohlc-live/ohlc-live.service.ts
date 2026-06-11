import { Injectable, OnModuleInit } from '@nestjs/common';
import { OhlcLiveGateway } from './ohlc-live.gateway';
import { MongoClient, Collection } from 'mongodb';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OhlcLiveService implements OnModuleInit {
  private mongoClient: MongoClient;
  private dbName: string = 'binance';

  constructor(
    private readonly ohlcGateway: OhlcLiveGateway,
    private readonly configService: ConfigService,
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
    try {
      const db = this.mongoClient.db(this.dbName);
      const collectionName = `OHLC_${symbol.toUpperCase()}`;
      const collection = db.collection(collectionName);

      const candles = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(200)
        .toArray();

      // MongoDB stores them in desc order, frontend needs them asc or handles them.
      // Usually, lightweight-charts needs them sorted by time.
      return candles.reverse();
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
    // (Optional - kept for reference)
    try {
      const redisKey = `ohlc_recent:${symbol.toUpperCase()}`;
    } catch (err) {
      console.error('[Redis Cache] Failed to update recent candles:', err);
    }

    // --- STEP 2: FLOW TO FRONTEND (WEBSOCKETS) ---
    this.ohlcGateway.broadcastCandle(symbol, data);

    console.log(
      `[Service] Processed and Broadcasted real-time candle for ${symbol}`,
    );
  }
}
