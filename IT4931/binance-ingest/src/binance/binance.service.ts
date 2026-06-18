import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WebSocket } from 'ws';
import { ClientKafka } from '@nestjs/microservices';
import { MongoClient } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt'];

interface AggTradeMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  a: number; // Aggregate trade ID
  p: string; // Price
  q: string; // Quantity
  f: number; // First trade ID
  l: number; // Last trade ID
  T: number; // Trade time
  m: boolean; // Is the buyer the market maker?
  M: boolean; // Ignore
}

@Injectable()
export class BinanceService implements OnModuleInit {
  private ws!: WebSocket;
  private mongoClient: MongoClient;
  private dbName: string = 'binance';
  private binanceWsBaseUrl: string;
  private binanceRestUrl: string;
  private proxyUrl: string | undefined;

  constructor(
    @Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka,
    private configService: ConfigService,
  ) {
    const mongoUri =
      this.configService.get<string>('MONGODB_URI') ||
      'mongodb://mongodb:27017/binance';
    this.mongoClient = new MongoClient(mongoUri);

    this.binanceWsBaseUrl =
      this.configService.get<string>('BINANCE_WS_URL') ||
      'wss://stream.binance.com:9443/ws';
    this.binanceRestUrl =
      this.configService.get<string>('BINANCE_REST_URL') ||
      'https://api.binance.com/api/v3';
    this.proxyUrl = this.configService.get<string>('BINANCE_PROXY_URL');
  }

  async onModuleInit() {
    try {
      await this.mongoClient.connect();
      console.log('[BinanceService] Connected to MongoDB');

      // Seed historical data for all symbols
      for (const symbol of SYMBOLS) {
        await this.seedHistoricalData(symbol);
      }
    } catch (err) {
      console.error('[BinanceService] MongoDB connection/seeding error:', err);
    }

    this.initBinanceSocket();
  }

  async seedHistoricalData(symbol: string) {
    try {
      const db = this.mongoClient.db(this.dbName);
      const collectionName = `OHLC_${symbol.toUpperCase()}`;
      const collection = db.collection(collectionName);

      // Check if we already have data
      const count = await collection.countDocuments();
      if (count > 0) {
        console.log(
          `[Seed] Data already exists for ${symbol}, skipping seeding.`,
        );
        return;
      }

      console.log(
        `[Seed] Fetching historical data (1m klines) for ${symbol}...`,
      );

      const httpsAgent = this.proxyUrl
        ? new HttpsProxyAgent(this.proxyUrl)
        : undefined;

      const response = await axios.get<Array<Array<string | number>>>(
        `${this.binanceRestUrl}/klines`,
        {
          params: {
            symbol: symbol.toUpperCase(),
            interval: '1m',
            limit: 1000,
          },
          httpsAgent,
        },
      );

      const klines = response.data.map((k) => ({
        timestamp: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
        closeTime: k[6] as number,
        symbol: symbol.toUpperCase(),
      }));

      await collection.insertMany(klines);
      console.log(
        `[Seed] Successfully seeded ${klines.length} klines for ${symbol}`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Seed] Error seeding data for ${symbol}:`, errorMessage);
    }
  }

  initBinanceSocket() {
    const streams = SYMBOLS.map((s) => `${s}@aggTrade`).join('/');
    const url = `${this.binanceWsBaseUrl}/${streams}`;

    console.log(`Connecting to Binance WebSocket: ${url}`);
    if (this.proxyUrl) {
      console.log(`Using proxy: ${this.proxyUrl}`);
    }

    const wsOptions = this.proxyUrl
      ? { agent: new HttpsProxyAgent(this.proxyUrl) as any }
      : {};

    this.ws = new WebSocket(url, wsOptions);

    this.ws.on('message', (data: Buffer) => {
      try {
        const rawData = JSON.parse(data.toString()) as AggTradeMessage;

        // Process @aggTrade data
        // Structure: https://binance-docs.github.io/apidocs/spot/en/#aggregate-trade-streams
        const tradeUpdate = {
          symbol: rawData.s, // Symbol
          price: parseFloat(rawData.p), // Price
          volume: parseFloat(rawData.q), // Quantity
          timestamp: rawData.E, // Event Time
          tradeId: rawData.a, // Aggregate trade ID
          isMaker: rawData.m, // Is the buyer the market maker?
        };

        if (this.kafkaClient) {
          this.kafkaClient.emit('binance-raw-ticks', tradeUpdate);
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    this.ws.on('open', () => {
      console.log('Connected to Binance WebSocket (@aggTrade)');
    });

    this.ws.on('error', (error) => {
      console.error('Socket error:', error);
      setTimeout(() => this.initBinanceSocket(), 5000);
    });

    this.ws.on('close', () => {
      console.log('Binance WebSocket closed. Reconnecting...');
      setTimeout(() => this.initBinanceSocket(), 5000);
    });
  }
}
