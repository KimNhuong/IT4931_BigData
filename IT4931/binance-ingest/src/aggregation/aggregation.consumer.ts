import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AggregationService } from './aggregation.service';

// Dùng interface hoặc import từ file khác để đảm bảo typing
export interface TickData {
  symbol: string;
  price: string;
  timestamp: number;
}

// Interface giả lập service nhận dữ liệu (không chứa logic tính toán)
export interface IAggregationService {
  processTick(data: TickData): void;
}

// Ở NestJS, để lắng nghe Kafka bắt buộc phải dùng @Controller (dù không mở API)
@Controller()
export class AggregationConsumer {
  private readonly logger = new Logger(AggregationConsumer.name);

  // Inject service khác vào để chuyển tiếp dữ liệu
  constructor(private readonly aggregationService: AggregationService) {}

  @EventPattern('crypto-prices')
  handleNewPrice(@Payload() message: any) {
    try {
      // Phân tích dữ liệu (NestJS thường tự động parse JSON, nhưng ta đảm bảo tính toàn vẹn)
      const tickData: TickData = typeof message === 'string' ? JSON.parse(message) : message;

      if (!tickData || !tickData.symbol || !tickData.price) {
        this.logger.warn(`Dữ liệu không hợp lệ: ${JSON.stringify(message)}`);
        return;
      }

      // Thuần tuý đóng vai trò vận chuyển: Giao lại cho service khác xử lý
      this.aggregationService.processTick(tickData);
      
    } catch (error) {
      this.logger.error('Lỗi khi phân tích dữ liệu Kafka', error);
    }
  }
}
