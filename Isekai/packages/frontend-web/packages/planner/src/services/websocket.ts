import { WebSocketServer, WebSocket } from 'ws';
import { winstonLogger } from '../utils/logger';
import { WebSocketMessage } from '@imagine/types';

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  start(server: any): void {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      winstonLogger.info('WebSocket client connected');

      ws.on('close', () => {
        this.clients.delete(ws);
        winstonLogger.info('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        winstonLogger.error('WebSocket error', error);
        this.clients.delete(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        data: { message: 'Connected to Imagine Platform' },
        timestamp: new Date().toISOString()
      }));
    });
  }

  broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          winstonLogger.error('Failed to send WebSocket message', error);
          this.clients.delete(client);
        }
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}