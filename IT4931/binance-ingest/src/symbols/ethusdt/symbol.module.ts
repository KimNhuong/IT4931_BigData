import { Module } from '@nestjs/common';
import { EthusdtService } from './symbol.service';
import { EthusdtController } from './symbol.controller';
import { KafkaModule } from '../../kafka/kafka.module';

@Module({
    imports: [KafkaModule],
    providers: [EthusdtService],
    controllers: [EthusdtController],
})
export class EthusdtModule {}
