import { Module } from '@nestjs/common';
import { BinanceController } from './binance.controller';

@Module({
  controllers: [BinanceController]
})
export class BinanceModule {}
