import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OhlcLiveService } from './ohlc-live.service';

const KAFKA_LIVE = process.env.KAFKA_LIVE || 'binance-live-ohlc';

@Controller('ohlc-live')
export class OhlcLiveController {

  constructor(private readonly ohlcLiveService: OhlcLiveService) {}

  @EventPattern(KAFKA_LIVE)
  async handleLiveOhlc(@Payload() data: any) {
    await this.ohlcLiveService.handleIncomingOhlc(data);
  }
}