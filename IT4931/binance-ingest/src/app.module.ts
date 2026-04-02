import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaModule } from './kafka/kafka.module';
import { ElasticSearchModule } from './elastic-search/elastic-search.module';
import { BinanceService } from './binance/binance.service';
import { BinanceModule } from './binance/binance.module';

@Module({
  imports: [KafkaModule, ElasticSearchModule, BinanceModule],
  controllers: [AppController],
  providers: [AppService, BinanceService],
})
export class AppModule {}
