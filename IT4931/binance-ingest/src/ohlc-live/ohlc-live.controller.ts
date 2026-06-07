import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

const KAFKA_LIVE = process.env.KAFKA_LIVE;

@Controller('ohlc-live')
export class OhlcLiveController {
  @EventPattern(KAFKA_LIVE)
  handleLiveOhlc(@Payload() data: any) {
    console.log('--- Received Live OHLC ---');
    console.log(`Symbol: ${data.symbol}`);
    console.log(`Window: ${data.timestamp}`);
    console.log(
      `O: ${data.open}, H: ${data.high}, L: ${data.low}, C: ${data.close}`,
    );
    console.log(`Volume: ${data.volume}`);
    console.log('--------------------------');
  }
}
