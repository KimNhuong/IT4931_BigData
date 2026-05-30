import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { WebSocket } from 'ws';

const SYMBOL = process.env.BINANCE_SYMBOL ?? 'ETHUSDT';
const TOPIC = process.env.KAFKA_TOPIC_SYMBOL ?? 'crypto-prices-ethusdt';

@Injectable()
export class EthusdtService implements OnModuleInit {
    private ws!: WebSocket;

    constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {}

    async onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(TOPIC);
        await this.kafkaClient.connect();
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