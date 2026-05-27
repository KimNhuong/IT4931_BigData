import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OhlcCandle } from '../aggregation/aggregation.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class CandleGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CandleGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() symbol: string, @ConnectedSocket() client: Socket) {
    if (!symbol) return;
    const room = `room:${symbol.toUpperCase()}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to symbol: ${symbol}`);
    client.emit('subscribed', { symbol, room });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@MessageBody() symbol: string, @ConnectedSocket() client: Socket) {
    if (!symbol) return;
    const room = `room:${symbol.toUpperCase()}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} unsubscribed from symbol: ${symbol}`);
    client.emit('unsubscribed', { symbol, room });
  }

  /**
   * Listen to the 'candle.created' event emitted from the AggregationService.
   * Broadcasts the candle to all subscribed clients in the respective room, 
   * and also broadcasts it generally to all clients listening to 'candles'.
   */
  @OnEvent('candle.created')
  handleCandleCreated(candle: any) {
    this.logger.debug(`Broadcasting candle for ${candle.symbol}`);
    
    // Broadcast to the specific symbol room (e.g., room:BTCUSDT)
    const room = `room:${candle.symbol.toUpperCase()}`;
    this.server.to(room).emit('candle.live', candle);

    // Broadcast globally to all connected clients listening on 'candles'
    this.server.emit('candle.all', candle);
  }
}
