import { Controller, Post, Body } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { StorageService } from './storage.service';
import { HydrationService } from './hydration.service';

interface TradeUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  tradeId: number;
  isMaker: boolean;
}

@Controller('binance')
export class BinanceController {
  constructor(
    private readonly storageService: StorageService,
    private readonly hydrationService: HydrationService,
  ) {}

  @Post('hydrate')
  async hydrate(@Body() body: { symbol: string, startDate: string, endDate: string }) {
    // Run in background to not block the response
    this.hydrationService.hydrateHistoricalData(body.symbol, body.startDate, body.endDate);
    return { message: 'Hydration started in background', ...body };
  }

  @EventPattern('binance-raw-ticks')
  async handleNewPrice(@Payload() data: TradeUpdate) {
    // This handles both the production to Kafka (if configured as consumer)
    // and the actual storage logic.
    await this.storageService.saveTick(data);
  }
}

