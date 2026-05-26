import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { ElasticSearchService } from './elastic-search.service';
import { OhlcCandle } from '../aggregation/aggregation.service';

describe('ElasticSearchService', () => {
  let service: ElasticSearchService;
  let mockNestElasticsearchService: any;
  let mockConfigService: any;

  const mockIndexName = 'test-binance-ohlc';

  beforeEach(async () => {
    mockNestElasticsearchService = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      update: jest.fn(),
      bulk: jest.fn(),
      search: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ELASTICSEARCH_INDEX_PREFIX') return 'test-binance';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElasticSearchService,
        {
          provide: NestElasticsearchService,
          useValue: mockNestElasticsearchService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ElasticSearchService>(ElasticSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIndexIfNotExists', () => {
    it('should create index if it does not exist', async () => {
      mockNestElasticsearchService.indices.exists.mockResolvedValue(false);
      mockNestElasticsearchService.indices.create.mockResolvedValue({ acknowledged: true });

      await service.createIndexIfNotExists();

      expect(mockNestElasticsearchService.indices.exists).toHaveBeenCalledWith({
        index: mockIndexName,
      });
      expect(mockNestElasticsearchService.indices.create).toHaveBeenCalledWith({
        index: mockIndexName,
        mappings: {
          properties: {
            symbol: { type: 'keyword' },
            open: { type: 'double' },
            high: { type: 'double' },
            low: { type: 'double' },
            close: { type: 'double' },
            startTime: { type: 'date' },
            endTime: { type: 'date' },
            '@timestamp': { type: 'date' },
          },
        },
      });
    });

    it('should not create index if it already exists', async () => {
      mockNestElasticsearchService.indices.exists.mockResolvedValue(true);

      await service.createIndexIfNotExists();

      expect(mockNestElasticsearchService.indices.exists).toHaveBeenCalledWith({
        index: mockIndexName,
      });
      expect(mockNestElasticsearchService.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('upsertCandle', () => {
    it('should call update with correct parameters', async () => {
      const candle: OhlcCandle = {
        symbol: 'BTCUSDT',
        open: '50000.00',
        high: '51000.00',
        low: '49000.00',
        close: '50500.00',
        startTime: 1711456000000,
        endTime: 1711456059999,
      };

      mockNestElasticsearchService.update.mockResolvedValue({ result: 'updated' });

      await service.upsertCandle(candle);

      expect(mockNestElasticsearchService.update).toHaveBeenCalledWith({
        index: mockIndexName,
        id: 'BTCUSDT_1711456000000',
        doc: {
          symbol: 'BTCUSDT',
          open: 50000,
          high: 51000,
          low: 49000,
          close: 50500,
          startTime: new Date(1711456000000),
          endTime: new Date(1711456059999),
          '@timestamp': new Date(1711456000000),
        },
        doc_as_upsert: true,
      });
    });
  });

  describe('bulkUpsert', () => {
    it('should perform bulk operations for provided candles', async () => {
      const candles: OhlcCandle[] = [
        {
          symbol: 'BTCUSDT',
          open: '50000.00',
          high: '51000.00',
          low: '49000.00',
          close: '50500.00',
          startTime: 1711456000000,
          endTime: 1711456059999,
        },
        {
          symbol: 'ETHUSDT',
          open: '3000.00',
          high: '3100.00',
          low: '2900.00',
          close: '3050.00',
          startTime: 1711456000000,
          endTime: 1711456059999,
        },
      ];

      mockNestElasticsearchService.bulk.mockResolvedValue({ errors: false, items: [] });

      await service.bulkUpsert(candles);

      expect(mockNestElasticsearchService.bulk).toHaveBeenCalledWith({
        operations: [
          { update: { _index: mockIndexName, _id: 'BTCUSDT_1711456000000' } },
          {
            doc: {
              symbol: 'BTCUSDT',
              open: 50000,
              high: 51000,
              low: 49000,
              close: 50500,
              startTime: new Date(1711456000000),
              endTime: new Date(1711456059999),
              '@timestamp': new Date(1711456000000),
            },
            doc_as_upsert: true,
          },
          { update: { _index: mockIndexName, _id: 'ETHUSDT_1711456000000' } },
          {
            doc: {
              symbol: 'ETHUSDT',
              open: 3000,
              high: 3100,
              low: 2900,
              close: 3050,
              startTime: new Date(1711456000000),
              endTime: new Date(1711456059999),
              '@timestamp': new Date(1711456000000),
            },
            doc_as_upsert: true,
          },
        ],
      });
    });
  });

  describe('getHistoricalCandles', () => {
    it('should search with correct queries', async () => {
      mockNestElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _source: {
                symbol: 'BTCUSDT',
                open: 50000,
                high: 51000,
                low: 49000,
                close: 50500,
                startTime: '2024-03-26T16:26:40.000Z',
              },
            },
          ],
        },
      });

      const result = await service.getHistoricalCandles('BTCUSDT', 1711456000000, 1711456060000, 10);

      expect(mockNestElasticsearchService.search).toHaveBeenCalledWith({
        index: mockIndexName,
        query: {
          bool: {
            must: [
              { term: { symbol: 'BTCUSDT' } },
              {
                range: {
                  startTime: {
                    gte: 1711456000000,
                    lte: 1711456060000,
                  },
                },
              },
            ],
          },
        },
        sort: [{ startTime: 'desc' }],
        size: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BTCUSDT');
    });
  });

  describe('handleCandleCreatedEvent', () => {
    it('should call upsertCandle', async () => {
      const candle: OhlcCandle = {
        symbol: 'BTCUSDT',
        open: '50000.00',
        high: '51000.00',
        low: '49000.00',
        close: '50500.00',
        startTime: 1711456000000,
        endTime: 1711456059999,
      };

      const upsertSpy = jest.spyOn(service, 'upsertCandle').mockResolvedValue(undefined);

      await service.handleCandleCreatedEvent(candle);

      expect(upsertSpy).toHaveBeenCalledWith(candle);
    });
  });
});
