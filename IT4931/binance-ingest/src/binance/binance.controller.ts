import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller('binance')
export class BinanceController {
    @EventPattern('binance-raw-ticks')
    handleNewPrice(@Payload() data:any){
        console.log('Symbol: ',data.symbol, 'data', data ); 
    }
}
