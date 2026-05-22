import { Module } from '@nestjs/common';
import { AggregationConsumer } from './aggregation.consumer';
import { AggregationService } from './aggregation.service';

@Module({
  // Không import KafkaModule/ClientsModule ở đây vì Consumer không chủ động kết nối ra ngoài, 
  // nó được NestJS tự động map thông qua cấu hình Microservice ở main.ts
  controllers: [AggregationConsumer],
  providers: [
    {
      provide: 'IAggregationService', // Optional: map interface to implementation
      useClass: AggregationService,
    },
    AggregationService,
  ],
})
export class AggregationModule {}
