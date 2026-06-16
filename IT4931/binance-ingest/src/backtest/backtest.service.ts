import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { MongoClient, ObjectId } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class BacktestService implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  private mongoClient: MongoClient;
  private dbName: string = 'binance';

  constructor(
    @Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka,
    private configService: ConfigService,
  ) {
    const mongoUri = this.configService.get<string>('MONGODB_URI') || 'mongodb://mongodb:27017/binance';
    this.mongoClient = new MongoClient(mongoUri);
  }

  async onModuleInit() {
    try {
      await this.mongoClient.connect();
      console.log('[BacktestService] Connected to MongoDB');
    } catch (err) {
      console.error('[BacktestService] MongoDB connection error:', err);
    }
  }

  async createJob(data: { symbol: string; strategy: string; timeRange: string }) {
    const db = this.mongoClient.db(this.dbName);
    const collection = db.collection('backtest_jobs');
    
    const result = await collection.insertOne({
      ...data,
      status: 'PENDING',
      createdAt: new Date(),
    });

    const jobId = result.insertedId.toString();

    // Emit job to Kafka
    this.kafkaClient.emit('binance-backtest-jobs', {
      jobId,
      symbol: data.symbol,
      strategy: data.strategy,
    });

    return { jobId, status: 'PENDING' };
  }

  async handleResult(resultData: any) {
    console.log('[BacktestService] Received result from Kafka:', resultData);
    
    // Sometimes resultData comes wrapped depending on kafka serialization
    const data = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
    const value = data.value ? data.value : data; // Extract value if kafka wraps it

    const db = this.mongoClient.db(this.dbName);
    const collection = db.collection('backtest_jobs');

    try {
       await collection.updateOne(
          { _id: new ObjectId(value.jobId as string) },
          { $set: { status: value.status, metrics: value.metrics, error: value.error, updatedAt: new Date() } }
       );
    } catch(e) {
       console.error("Error updating mongo for job", value.jobId, e)
    }

    if (this.server) {
       this.server.emit('backtest-finished', value);
    }
  }
}
