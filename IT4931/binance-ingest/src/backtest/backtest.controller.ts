import { Controller, Post, Body } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  async createBacktestJob(@Body() body: { symbol: string; strategy: string; timeRange: string }) {
    return this.backtestService.createJob(body);
  }

  @EventPattern('binance-backtest-results')
  async handleBacktestResult(@Payload() resultData: any) {
    await this.backtestService.handleResult(resultData);
  }
}
