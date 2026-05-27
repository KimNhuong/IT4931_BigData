import { Module } from '@nestjs/common';
import { CandleGateway } from './candle.gateway';

@Module({
  providers: [CandleGateway],
  exports: [CandleGateway],
})
export class GatewayModule {}
