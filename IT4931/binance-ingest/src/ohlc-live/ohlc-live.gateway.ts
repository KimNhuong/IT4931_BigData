import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class OhlcLiveGateway {
  @WebSocketServer()
  server: Server | undefined;

  // Lắng nghe khi Frontend gửi lệnh muốn "sub" một cặp coin nào đó
  @SubscribeMessage('joinSymbol')
  handleJoinSymbol(
    @MessageBody() symbol: string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `room_${symbol.toUpperCase()}`;
    client.join(roomName);
    console.log(`[WebSocket] Client ${client.id} joined ${roomName}`);
  }

  broadcastCandle(symbol: string, candleData: any) {
    const roomName = `room_${symbol.toUpperCase()}`;
    if (!this.server) {
      return;
    }
    this.server.to(roomName).emit('candle-update', candleData);
  }

  broadcastTick(symbol: string, tickData: any) {
    const roomName = `room_${symbol.toUpperCase()}`;
    if (!this.server) {
      return;
    }
    this.server.to(roomName).emit('tick-update', tickData);
  }

  broadcastWhaleAlert(symbol: string, alertData: any) {
    if (!this.server) {
      return;
    }
    // Gửi cho tất cả mọi người hoặc có thể giới hạn theo room nếu cần
    this.server.emit('whale-alert', alertData);
  }
}
