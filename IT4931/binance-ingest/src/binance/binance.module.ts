import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { BinanceService } from './binance.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [KafkaModule, ClientsModule],
  providers: [BinanceService], 
})
export class BinanceModule {}
