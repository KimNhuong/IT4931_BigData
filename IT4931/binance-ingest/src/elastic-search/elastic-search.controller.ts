import { Controller, Get, Param, Query } from '@nestjs/common';
import { ElasticSearchService } from './elastic-search.service';

@Controller('elastic-search')
export class ElasticSearchController {
  constructor(private readonly elasticSearchService: ElasticSearchService) {}

  @Get('historical/:symbol')
  async getHistoricalCandles(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const fromTimestamp = from ? parseInt(from, 10) : undefined;
    const toTimestamp = to ? parseInt(to, 10) : undefined;
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 100;

    return this.elasticSearchService.getHistoricalCandles(
      symbol.toUpperCase(),
      fromTimestamp,
      toTimestamp,
      parsedPage,
      parsedLimit,
    );
  }
}
