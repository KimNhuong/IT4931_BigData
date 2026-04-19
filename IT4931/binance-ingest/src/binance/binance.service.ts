import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { error } from 'node:console';
import { WebSocket } from 'ws';
import { ClientKafka } from '@nestjs/microservices';

const BTCUSDT_SOCKET_ENDPOINT = process.env.BINANCE_BTCUSDT_TICKER;

@Injectable()
export class BinanceService implements OnModuleInit {
    private ws!: WebSocket; 

     constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {}

   onModuleInit(){ 
     this.kafkaClient.subscribeToResponseOf('BinanceUSDT-ticker');
     this.initBinanceSocket();  
   }

   initBinanceSocket(){ 
    this.ws = new WebSocket(BTCUSDT_SOCKET_ENDPOINT!); 

    this.ws.on('message', (data)=> { 
        const rawData = JSON.parse(data.toString()); 

        const priceUpdate = { 
            symbol: rawData.s, 
            price: rawData.c,
            timestamp: rawData.E, 
        }; 

        if(this.kafkaClient){ 
            this.kafkaClient.emit('BinanceUSDT-ticker', priceUpdate);
        } else throw error; 
 
        console.log('sent to kafka: ', priceUpdate.symbol ,' - ',  priceUpdate.price)
    })

        this.ws.on('error', (error)=> { 
            console.error('socket error ', error); 
            setTimeout(()=> this.initBinanceSocket(), 5000); 
        })
   }
}
