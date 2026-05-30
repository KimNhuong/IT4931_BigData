import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

const TOPIC = process.env.KAFKA_TOPIC_SYMBOL ?? 'crypto-prices-ethusdt';

@Controller()
export class EthusdtController {
    @EventPattern(TOPIC)
    handlePrice(@Payload() data: any) {
        console.log(`[Price Update] ${data.symbol}: ${data.price}`);
    }
}