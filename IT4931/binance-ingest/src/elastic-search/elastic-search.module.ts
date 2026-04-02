import { Module } from '@nestjs/common';
import { ElasticSearchService } from './elastic-search.service';
import { ElasticSearchController } from './elastic-search.controller';

@Module({
  providers: [ElasticSearchService],
  controllers: [ElasticSearchController]
})
export class ElasticSearchModule {}
