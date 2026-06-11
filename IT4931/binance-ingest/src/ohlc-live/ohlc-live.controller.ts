import { Controller, Get, Param } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OhlcLiveService } from './ohlc-live.service';

const KAFKA_LIVE = process.env.KAFKA_LIVE || 'binance-live-ohlc';

@Controller('ohlc-live')
export class OhlcLiveController {
  constructor(private readonly ohlcLiveService: OhlcLiveService) {}

  @Get(':symbol')
  async getHistoricalData(@Param('symbol') symbol: string) {
    return await this.ohlcLiveService.getHistoricalOHLC(symbol);
  }

  @EventPattern(KAFKA_LIVE)
  async handleLiveOhlc(@Payload() data: any) {
    await this.ohlcLiveService.handleIncomingOhlc(data);
  }
}
