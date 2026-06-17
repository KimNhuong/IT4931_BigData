import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import axios from 'axios';
import * as unzipper from 'unzipper';
import { parse } from 'csv-parse';
import { format, addDays, isBefore, parseISO } from 'date-fns';

@Injectable()
export class HydrationService {
  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async hydrateHistoricalData(symbol: string, startDate: string, endDate: string) {
    let current = parseISO(startDate);
    const end = parseISO(endDate);

    console.log(`[Hydration] Starting for ${symbol} from ${startDate} to ${endDate}`);

    while (isBefore(current, addDays(end, 1))) {
      const dateStr = format(current, 'yyyy-MM-dd');
      await this.processDay(symbol, dateStr);
      current = addDays(current, 1);
    }

    console.log(`[Hydration] Completed for ${symbol}`);
  }

  private async processDay(symbol: string, date: string) {
    const url = `https://data.binance.vision/data/spot/daily/aggTrades/${symbol}/${symbol}-aggTrades-${date}.zip`;
    
    try {
      console.log(`[Hydration] Processing ${date} from ${url}`);
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
      });

      return new Promise((resolve, reject) => {
        response.data
          .pipe(unzipper.ParseOne())
          .pipe(parse({ delimiter: ',' }))
          .on('data', (row) => {
            // Mapping Binance CSV to our TradeUpdate format
            // CSV columns: agg_trade_id, price, quantity, first_trade_id, last_trade_id, transact_time, is_buyer_maker, is_best_match
            const trade = {
              tradeId: parseInt(row[0]),
              price: parseFloat(row[1]),
              volume: parseFloat(row[2]),
              timestamp: parseInt(row[5]),
              isMaker: row[6] === 'true',
              symbol: symbol,
            };

            this.kafkaClient.emit('binance-raw-ticks', trade);
          })
          .on('end', () => {
            console.log(`[Hydration] Finished processing ${date}`);
            resolve(true);
          })
          .on('error', (err) => {
            console.error(`[Hydration] Error processing ${date}:`, err.message);
            // We resolve even on error to continue with next days
            resolve(false);
          });
      });
    } catch (err) {
      console.error(`[Hydration] Failed to fetch ${date}: ${err.message}`);
    }
  }
}
