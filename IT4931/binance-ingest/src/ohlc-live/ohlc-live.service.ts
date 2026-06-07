import { Injectable } from '@nestjs/common';

@Injectable()
export class OhlcLiveService {
    initOhlcLive() { 
        console.log('receicve data')
    }
}
