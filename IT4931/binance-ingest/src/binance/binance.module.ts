import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { BinanceController } from './binance.controller';
import { BinanceService } from './binance.service';
import { KafkaModule } from '../kafka/kafka.module';


@Module({
  imports: [KafkaModule, ClientsModule],
  controllers: [BinanceController],
  providers: [ BinanceService ], 
})
export class BinanceModule {}
