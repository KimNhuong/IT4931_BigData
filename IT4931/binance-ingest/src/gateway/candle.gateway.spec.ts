import { Test, TestingModule } from '@nestjs/testing';
import { CandleGateway } from './candle.gateway';
import { Socket, Server } from 'socket.io';

describe('CandleGateway', () => {
  let gateway: CandleGateway;
  let mockSocket: any;
  let mockServer: any;

  beforeEach(async () => {
    mockSocket = {
      id: 'mock-socket-id',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CandleGateway],
    }).compile();

    gateway = module.get<CandleGateway>(CandleGateway);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('subscribe', () => {
    it('should join the correct room and emit subscribed confirmation', () => {
      gateway.handleSubscribe('BTCUSDT', mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('room:BTCUSDT');
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribed', {
        symbol: 'BTCUSDT',
        room: 'room:BTCUSDT',
      });
    });

    it('should do nothing if symbol is empty', () => {
      gateway.handleSubscribe('', mockSocket as Socket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should leave the room and emit unsubscribed confirmation', () => {
      gateway.handleUnsubscribe('ETHUSDT', mockSocket as Socket);

      expect(mockSocket.leave).toHaveBeenCalledWith('room:ETHUSDT');
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribed', {
        symbol: 'ETHUSDT',
        room: 'room:ETHUSDT',
      });
    });

    it('should do nothing if symbol is empty', () => {
      gateway.handleUnsubscribe('', mockSocket as Socket);

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleCandleCreated', () => {
    it('should broadcast candle to the room and globally', () => {
      const candle = {
        symbol: 'ADAUSDT',
        open: 0.242,
        high: 0.243,
        low: 0.241,
        close: 0.242,
        startTime: 1711456000000,
        endTime: 1711456059999,
      };

      gateway.handleCandleCreated(candle);

      expect(mockServer.to).toHaveBeenCalledWith('room:ADAUSDT');
      expect(mockServer.emit).toHaveBeenCalledWith('candle.live', candle);
      expect(mockServer.emit).toHaveBeenCalledWith('candle.all', candle);
    });
  });
});
