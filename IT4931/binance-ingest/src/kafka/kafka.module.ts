import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

const LOCAL_KAFKA_BROKER = process.env.KAFKA_BROKER || '';
const LOCAL_KAFKA_GROUP = process.env.KAFKA_GROUP_ID || ''; 

@Module({
    imports: [ 
        ClientsModule.register([
            {
                name: 'KAFKA_SERVICE',
                transport: Transport.KAFKA, 
                options:{ 
                    client: { 
                        clientId: 'binance-producer', 
                        brokers: [LOCAL_KAFKA_BROKER]
                    }, 
                    consumer: {
                        groupId: LOCAL_KAFKA_GROUP, 
                    }
                }
            }
        ])
    ],
    exports: [ClientsModule]

})
export class KafkaModule {}
