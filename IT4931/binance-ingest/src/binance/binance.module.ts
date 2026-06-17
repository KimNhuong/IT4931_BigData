import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { BinanceController } from './binance.controller';
import { BinanceService } from './binance.service';
import { StorageService } from './storage.service';
import { HydrationService } from './hydration.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [KafkaModule, ClientsModule],
  controllers: [BinanceController],
  providers: [BinanceService, StorageService, HydrationService],
})
export class BinanceModule {}
