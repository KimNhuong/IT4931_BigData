import { Module } from '@nestjs/common';
import { OhlcLiveService } from './ohlc-live.service';
import { OhlcLiveController } from './ohlc-live.controller';

@Module({
  providers: [OhlcLiveService],
  controllers: [OhlcLiveController]
})
export class OhlcLiveModule {}
