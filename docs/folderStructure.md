```
src/
├── app.module.ts            # Root module: orchestrates all other modules
├── main.ts                  # Entry point: initializes the NestJS app/microservice
│
├── common/                  # Shared utilities (Constants, Interfaces, Types)
│   ├── constants/           # e.g., KAFKA_SERVICE_NAME, TOPIC_NAME
│   └── interfaces/          # TypeScript interfaces for Binance/Kafka payloads
│
├── kafka/                   # Kafka Wrapper Module (Infrastructure layer)
│   ├── kafka.module.ts      # Configures ClientsModule.register()
│   └── kafka.producer.ts    # Reusable service to send messages to Kafka
│
└── binance/                 # Business Logic Module
    ├── binance.module.ts    # Imports KafkaModule
    ├── binance.service.ts   # Connects to WebSocket & pipes data to Kafka
    └── dto/                 # Data Transfer Objects (Validation/Formatting)
```