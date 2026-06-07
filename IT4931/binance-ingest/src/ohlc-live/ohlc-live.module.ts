import { Module } from '@nestjs/common';
import { OhlcLiveService } from './ohlc-live.service';
import { OhlcLiveController } from './ohlc-live.controller';
import { OhlcLiveGateway } from './ohlc-live.gateway';

@Module({
  providers: [OhlcLiveService],
  controllers: [OhlcLiveController, OhlcLiveGateway]
})
export class OhlcLiveModule {}
