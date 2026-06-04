import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WebSocket } from 'ws';
import { ClientKafka } from '@nestjs/microservices';

const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt'];
const BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/ws';

@Injectable()
export class BinanceService implements OnModuleInit {
    private ws!: WebSocket; 

    constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {}

    onModuleInit() { 
        this.initBinanceSocket();  
    }

    initBinanceSocket() { 
        const streams = SYMBOLS.map(s => `${s}@ticker`).join('/');
        const url = `${BINANCE_WS_BASE_URL}/${streams}`;
        
        this.ws = new WebSocket(url); 

        this.ws.on('message', (data) => { 
            try {
                const rawData = JSON.parse(data.toString()); 

                const priceUpdate = { 
                    symbol: rawData.s, // Symbol
                    price: parseFloat(rawData.c), // Last Price
                    volume: parseFloat(rawData.v), // Total Traded Base Asset Volume
                    timestamp: rawData.E, // Event Time
                    high: parseFloat(rawData.h),
                    low: parseFloat(rawData.l),
                    open: parseFloat(rawData.o),
                }; 

                if (this.kafkaClient) { 
                    this.kafkaClient.emit('binance-raw-ticks', priceUpdate);
                }
         
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });

        this.ws.on('open', () => {
            console.log('Connected to Binance WebSocket');
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
