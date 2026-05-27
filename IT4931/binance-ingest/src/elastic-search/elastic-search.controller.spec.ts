import { Test, TestingModule } from '@nestjs/testing';
import { ElasticSearchController } from './elastic-search.controller';
import { ElasticSearchService } from './elastic-search.service';

describe('ElasticSearchController', () => {
  let controller: ElasticSearchController;
  let mockElasticSearchService: any;

  beforeEach(async () => {
    mockElasticSearchService = {
      getHistoricalCandles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElasticSearchController],
      providers: [
        {
          provide: ElasticSearchService,
          useValue: mockElasticSearchService,
        },
      ],
    }).compile();

    controller = module.get<ElasticSearchController>(ElasticSearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHistoricalCandles', () => {
    it('should call getHistoricalCandles with parsed parameters', async () => {
      mockElasticSearchService.getHistoricalCandles.mockResolvedValue([{ symbol: 'BTCUSDT' }]);

      const result = await controller.getHistoricalCandles(
        'btcusdt',
        '1711456000000',
        '1711456060000',
        '2',
        '20',
      );

      expect(mockElasticSearchService.getHistoricalCandles).toHaveBeenCalledWith(
        'BTCUSDT',
        1711456000000,
        1711456060000,
        2,
        20,
      );
      expect(result).toEqual([{ symbol: 'BTCUSDT' }]);
    });

    it('should use default limit/page and handle undefined from/to parameters', async () => {
      mockElasticSearchService.getHistoricalCandles.mockResolvedValue([]);

      await controller.getHistoricalCandles('ethusdt');

      expect(mockElasticSearchService.getHistoricalCandles).toHaveBeenCalledWith(
        'ETHUSDT',
        undefined,
        undefined,
        1,
        100,
      );
    });
  });
});
