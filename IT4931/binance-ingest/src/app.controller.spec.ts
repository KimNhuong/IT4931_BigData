import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticSearchService } from './elastic-search/elastic-search.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      ping: jest.fn().mockResolvedValue('PONG'),
    };
  });
});

describe('AppController', () => {
  let appController: AppController;
  let mockElasticSearchService: any;

  beforeEach(async () => {
    mockElasticSearchService = {
      ping: jest.fn().mockResolvedValue(true),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ElasticSearchService,
          useValue: mockElasticSearchService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return status ok and 200 when all services are up', async () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((payload) => payload),
      };

      await appController.checkHealth(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          services: {
            elasticsearch: 'up',
            redis: 'up',
          },
        }),
      );
    });

    it('should return status error and 503 when elasticsearch is down', async () => {
      mockElasticSearchService.ping.mockResolvedValue(false);
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((payload) => payload),
      };

      await appController.checkHealth(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          services: {
            elasticsearch: 'down',
            redis: 'up',
          },
        }),
      );
    });
  });
});
