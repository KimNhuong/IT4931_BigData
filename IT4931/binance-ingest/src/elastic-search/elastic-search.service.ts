import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { OhlcCandle } from '../aggregation/aggregation.service';

@Injectable()
export class ElasticSearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticSearchService.name);
  private readonly indexName: string;

  constructor(
    private readonly elasticsearchService: NestElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    const prefix = this.configService.get<string>('ELASTICSEARCH_INDEX_PREFIX') || 'binance';
    this.indexName = `${prefix}-ohlc`;
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing Elasticsearch Service...');
      await this.createIndexIfNotExists();
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch Service', error);
    }
  }

  /**
   * Checks if the ohlc index exists, and creates it with mappings if not.
   */
  async createIndexIfNotExists() {
    try {
      const exists = await this.elasticsearchService.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        this.logger.log(`Index "${this.indexName}" does not exist. Creating...`);
        await this.elasticsearchService.indices.create({
          index: this.indexName,
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
        this.logger.log(`Index "${this.indexName}" created successfully with mappings.`);
      } else {
        this.logger.log(`Index "${this.indexName}" already exists.`);
      }
    } catch (error) {
      this.logger.error(`Error checking/creating index "${this.indexName}"`, error);
      throw error;
    }
  }

  /**
   * Listen to the 'candle.created' event emitted from the AggregationService.
   */
  @OnEvent('candle.created')
  async handleCandleCreatedEvent(candle: any) {
    this.logger.debug(`Received candle.created event for ${candle.symbol}`);
    await this.upsertCandle(candle);
  }

  /**
   * Upsert a single OHLC candle document into Elasticsearch.
   * Document ID is structured as: {symbol}_{startTime}
   */
  async upsertCandle(candle: OhlcCandle): Promise<void> {
    try {
      const id = `${candle.symbol}_${candle.startTime}`;
      
      const document = {
        symbol: candle.symbol,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        startTime: new Date(candle.startTime),
        endTime: new Date(candle.endTime),
        '@timestamp': new Date(candle.startTime),
      };

      await this.elasticsearchService.update({
        index: this.indexName,
        id,
        doc: document,
        doc_as_upsert: true,
      });

      this.logger.log(`[ES] Upserted candle for ${candle.symbol} at ${new Date(candle.startTime).toISOString()}`);
    } catch (error) {
      this.logger.error(`Failed to upsert candle for ${candle.symbol}`, error);
    }
  }

  /**
   * Bulk upserts a list of OHLC candles.
   */
  async bulkUpsert(candles: OhlcCandle[]): Promise<void> {
    if (!candles || candles.length === 0) {
      return;
    }

    try {
      const operations = candles.flatMap((candle) => {
        const id = `${candle.symbol}_${candle.startTime}`;
        const doc = {
          symbol: candle.symbol,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          startTime: new Date(candle.startTime),
          endTime: new Date(candle.endTime),
          '@timestamp': new Date(candle.startTime),
        };
        return [
          { update: { _index: this.indexName, _id: id } },
          { doc, doc_as_upsert: true },
        ];
      });

      const response = await this.elasticsearchService.bulk({
        operations,
      });

      if (response.errors) {
        this.logger.error('Bulk index operation had some errors');
        const erroredItems = response.items.filter((item) => {
          const operation = Object.keys(item)[0];
          return item[operation].error;
        });
        this.logger.error(`First few errors: ${JSON.stringify(erroredItems.slice(0, 3))}`);
      } else {
        this.logger.log(`[ES] Bulk upserted ${candles.length} candles successfully.`);
      }
    } catch (error) {
      this.logger.error('Failed to perform bulk upsert', error);
      throw error;
    }
  }

  /**
   * Helper search function for historical queries (Phase 6) with pagination and filtering.
   */
  async getHistoricalCandles(
    symbol: string,
    from?: number,
    to?: number,
    page = 1,
    limit = 100,
  ): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const query: any = {
        bool: {
          must: [{ term: { symbol } }],
        },
      };

      if (from || to) {
        const range: any = {};
        if (from) range.gte = from;
        if (to) range.lte = to;
        query.bool.must.push({ range: { startTime: range } });
      }

      const fromIndex = (page - 1) * limit;

      const response = await this.elasticsearchService.search({
        index: this.indexName,
        query,
        sort: [{ startTime: 'desc' }],
        from: fromIndex,
        size: limit,
      });

      const totalHits = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : (response.hits.total as any)?.value || 0;

      const data = response.hits.hits.map((hit: any) => hit._source);

      return {
        data,
        total: totalHits,
        page,
        limit,
        totalPages: Math.ceil(totalHits / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch historical candles for ${symbol}`, error);
      throw error;
    }
  }

  /**
   * Ping Elasticsearch to verify connection health.
   */
  async ping(): Promise<boolean> {
    try {
      await this.elasticsearchService.ping();
      return true;
    } catch (error) {
      this.logger.error('Elasticsearch ping failed', error);
      return false;
    }
  }
}
