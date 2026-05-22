import { Injectable, Logger } from '@nestjs/common';
import { TickData, IAggregationService } from './aggregation.consumer';

@Injectable()
export class AggregationService implements IAggregationService {
  private readonly logger = new Logger(AggregationService.name);

  processTick(data: TickData): void {
    // Phase 4: Logic tính toán nến OHLC và lưu Redis sẽ viết ở đây.
    // Hiện tại chỉ log ra để xác nhận Phase 3 (Consumer) đã chuyển dữ liệu thành công.
    this.logger.log(`Received tick for ${data.symbol}: ${data.price} at ${data.timestamp}`);
  }
}
