import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { StorageService } from './storage.service';

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
  constructor(private readonly storageService: StorageService) {}

  @EventPattern('binance-raw-ticks')
  async handleNewPrice(@Payload() data: TradeUpdate) {
    // This handles both the production to Kafka (if configured as consumer)
    // and the actual storage logic.
    await this.storageService.saveTick(data);
  }
}

