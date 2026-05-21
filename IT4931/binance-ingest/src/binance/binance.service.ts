import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { WebSocket } from 'ws';

@Injectable()
export class BinanceService implements OnModuleInit {
  private ws: WebSocket;
  private readonly logger = new Logger(BinanceService.name);

  constructor(@Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka) {}

  async onModuleInit() {
    // Phải gọi connect() để Kafka Producer khởi động trước khi bắn dữ liệu
    await this.kafkaClient.connect();
    this.initBinanceSocket();
  }

  private initBinanceSocket() {
    // Kết nối đến Binance WebSocket (cặp ADAUSDT)
    this.ws = new WebSocket('wss://stream.binance.com:9443/ws/adausdt@ticker');

    this.ws.on('open', () => {
      this.logger.log('Connected to Binance WebSocket (ADAUSDT)');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const rawData = JSON.parse(data.toString());
        
        const priceUpdate = {
          symbol: rawData.s,
          price: rawData.c,
          timestamp: rawData.E,
        };

        // Bắn dữ liệu thẳng vào Kafka topic 'crypto-prices'
        // Phải gọi .subscribe() vì NestJS dùng RxJS (Lazy Observable)
        this.kafkaClient.emit('crypto-prices', priceUpdate).subscribe({
          error: (err) => this.logger.error('Failed to emit to Kafka', err)
        });
        
      } catch (error) {
        this.logger.error('Error parsing message', error);
      }
    });

    this.ws.on('error', (error) => {
      this.logger.error('WebSocket Error', error);
      // Reconnect sau 5s
      setTimeout(() => this.initBinanceSocket(), 5000);
    });

    this.ws.on('close', () => {
      this.logger.warn('WebSocket Closed. Reconnecting...');
      // Reconnect sau 5s
      setTimeout(() => this.initBinanceSocket(), 5000);
    });
  }
}
