import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { ElasticSearchService } from './elastic-search/elastic-search.service';
import Redis from 'ioredis';

@Controller()
export class AppController {
  private redisClient: Redis;

  constructor(
    private readonly appService: AppService,
    private readonly elasticSearchService: ElasticSearchService,
  ) {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1, // Fail fast for health checks
    });
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async checkHealth(@Res() res) {
    let elasticsearchUp = false;
    let redisUp = false;

    try {
      elasticsearchUp = await this.elasticSearchService.ping();
    } catch (e) {
      // Keep false
    }

    try {
      const pingRes = await this.redisClient.ping();
      redisUp = pingRes === 'PONG';
    } catch (e) {
      // Keep false
    }

    const isHealthy = elasticsearchUp && redisUp;

    const payload = {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        elasticsearch: elasticsearchUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
      },
    };

    if (isHealthy) {
      return res.status(HttpStatus.OK).json(payload);
    } else {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(payload);
    }
  }
}
