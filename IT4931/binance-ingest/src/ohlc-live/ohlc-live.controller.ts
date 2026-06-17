import { Controller, Get, Param } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OhlcLiveService } from './ohlc-live.service';

const KAFKA_LIVE = process.env.KAFKA_LIVE || 'binance-live-ohlc';
const KAFKA_TICKS = process.env.KAFKA_TICKS || 'binance-live-ticks';
const KAFKA_WHALES = process.env.KAFKA_WHALES || 'binance-whale-alerts';

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

  @EventPattern(KAFKA_TICKS)
  async handleLiveTicks(@Payload() data: any) {
    await this.ohlcLiveService.handleIncomingTick(data);
  }

  @EventPattern(KAFKA_WHALES)
  async handleWhaleAlert(@Payload() data: any) {
    await this.ohlcLiveService.handleIncomingWhaleAlert(data);
  }
}
