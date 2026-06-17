import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_GROUP = process.env.KAFKA_GROUP_ID || 'binance-ingest-group';
const CA_CERT = process.env.KAFKA_CA_CERT;
const SASL_USERNAME = process.env.KAFKA_SASL_USERNAME;
const SASL_PASSWORD = process.env.KAFKA_SASL_PASSWORD;

// Helper function to handle CA Certificate from environment
let caBuffer: Buffer | undefined;
if (CA_CERT) {
  try {
    // Hugging Face Secrets might escape newlines as \n string
    const formattedCert = CA_CERT.replace(/\\n/g, '\n');
    caBuffer = Buffer.from(formattedCert, 'utf8');
    const tmpCertPath = path.join(os.tmpdir(), 'aiven_ca.pem');
    fs.writeFileSync(tmpCertPath, caBuffer);
  } catch (error) {
    console.warn('Failed to parse KAFKA_CA_CERT from environment', error);
  }
}

// Build SSL configuration based on env vars
const sslConfig =
  CA_CERT || (SASL_USERNAME && SASL_PASSWORD)
    ? {
        rejectUnauthorized: false, // For Aiven / managed Kafka
        ...(caBuffer && { ca: [caBuffer] }),
      }
    : undefined;

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'binance-producer',
            brokers: [KAFKA_BROKER],
            ...(sslConfig && { ssl: sslConfig }),
            ...(SASL_USERNAME &&
              SASL_PASSWORD && {
                sasl: {
                  mechanism: (process.env.KAFKA_SASL_MECHANISM as any) || 'plain',
                  username: SASL_USERNAME,
                  password: SASL_PASSWORD,
                },
              }),
          },
          consumer: {
            groupId: KAFKA_GROUP,
          },
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}
