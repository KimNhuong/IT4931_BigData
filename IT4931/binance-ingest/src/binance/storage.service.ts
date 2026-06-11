import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

import * as parquet from 'parquetjs-lite';
import * as fs from 'fs';
import * as path from 'path';

interface TradeUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  tradeId: number;
  isMaker: boolean;
}

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private mongoClient: MongoClient;
  private s3Client: S3Client;
  private dbName = 'binance';
  private bucketName = 'binance-raw-ticks';

  private tickBuffer: TradeUpdate[] = [];
  private readonly BUFFER_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 60000; // 1 minute
  private flushTimer: NodeJS.Timeout | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  private parquetSchema = new parquet.ParquetSchema({
    symbol: { type: 'UTF8' },
    price: { type: 'DOUBLE' },
    volume: { type: 'DOUBLE' },
    timestamp: { type: 'INT64' },
    tradeId: { type: 'INT64' },
    isMaker: { type: 'BOOLEAN' },
  });

  constructor(private configService: ConfigService) {
    const mongoUri =
      this.configService.get<string>('MONGODB_URI') ||
      'mongodb://mongodb:27017/binance';
    this.mongoClient = new MongoClient(mongoUri);

    this.s3Client = new S3Client({
      endpoint:
        this.configService.get<string>('MINIO_ENDPOINT') || 'http://minio:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId:
          this.configService.get<string>('MINIO_ROOT_USER') || 'minioadmin',
        secretAccessKey:
          this.configService.get<string>('MINIO_ROOT_PASSWORD') || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.mongoClient.connect();
      console.log('[StorageService] Connected to MongoDB');
      await this.ensureBucketExists();
      this.flushTimer = setInterval(() => {
        void this.flushBuffer();
      }, this.FLUSH_INTERVAL);
    } catch (err) {
      console.error('[StorageService] Initialization error:', err);
    }
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushBuffer();
    await this.mongoClient.close();
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
    } catch {
      try {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
        console.log(`[MinIO] Bucket "${this.bucketName}" created.`);
      } catch (createErr) {
        console.error('[MinIO] Error creating bucket:', createErr);
      }
    }
  }

  async saveTick(data: TradeUpdate) {
    // 1. Save to MongoDB
    try {
      const db = this.mongoClient.db(this.dbName);
      const collectionName = `TICKS_${data.symbol.toUpperCase()}`;
      const collection = db.collection(collectionName);
      await collection.insertOne({
        ...data,
        storedAt: new Date(),
      });
    } catch (err) {
      console.error('[MongoDB] Error saving tick:', err);
    }

    // 2. Add to buffer for MinIO/Parquet
    this.tickBuffer.push(data);
    if (this.tickBuffer.length >= this.BUFFER_SIZE) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer() {
    if (this.tickBuffer.length === 0) return;

    console.log(
      `[StorageService] Flushing ${this.tickBuffer.length} ticks to MinIO...`,
    );
    const dataToFlush = [...this.tickBuffer];
    this.tickBuffer = [];

    const timestamp = Date.now();
    const fileName = `ticks_${timestamp}.parquet`;
    const tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const filePath = path.join(tempDir, fileName);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const writer = await parquet.ParquetWriter.openFile(
        this.parquetSchema,
        filePath,
      );
      for (const row of dataToFlush) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await writer.appendRow({
          symbol: row.symbol,
          price: row.price,
          volume: row.volume,
          timestamp: row.timestamp,
          tradeId: row.tradeId,
          isMaker: row.isMaker,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await writer.close();

      const fileContent = fs.readFileSync(filePath);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');

      const uploadParams = {
        Bucket: this.bucketName,
        Key: `year=${year}/month=${month}/day=${day}/${fileName}`,
        Body: fileContent,
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`[MinIO] Uploaded parquet file: ${uploadParams.Key}`);

      // Clean up local file
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('[StorageService] Error flushing buffer to MinIO:', err);
      // Put data back to buffer or log error
      this.tickBuffer = [...dataToFlush, ...this.tickBuffer];
    }
  }
}
