import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

const KAFKA_PRICES = process.env.KAFKA_TOPIC_PRICES; 

@Controller('binance')
export class BinanceController {
    @EventPattern(KAFKA_PRICES)
    handleNewPrice(@Payload() data:any){
        console.log( data.symbol, ' - ', data.price); 
    }
}
