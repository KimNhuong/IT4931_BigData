import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Lấy config xác thực từ biến môi trường (Hỗ trợ Aiven, Upstash, Confluent)
  const saslConfig = process.env.KAFKA_SASL_USERNAME ? {
    mechanism: (process.env.KAFKA_SASL_MECHANISM || 'plain').toLowerCase() as any,
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD,
  } : undefined;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
        ssl: process.env.KAFKA_CA_CERT ? { ca: [process.env.KAFKA_CA_CERT] } : !!process.env.KAFKA_SASL_USERNAME, // Bật SSL kèm CA tuỳ chỉnh nếu có
        sasl: saslConfig as any,
      },
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID || 'binance-consumer-group',
      },
    },
  });

  // Khởi chạy cả HTTP (nếu có) và Microservice
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
