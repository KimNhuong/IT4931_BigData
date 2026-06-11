import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaModule } from './kafka/kafka.module';
import { ElasticSearchModule } from './elastic-search/elastic-search.module';
import { BinanceModule } from './binance/binance.module';
import { ConfigModule } from '@nestjs/config';
import { OhlcLiveModule } from './ohlc-live/ohlc-live.module';

@Module({
  imports: [
    KafkaModule,
    ElasticSearchModule,
    BinanceModule,
    ConfigModule.forRoot(
      //extends here
      { isGlobal: true },
    ),
    OhlcLiveModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
