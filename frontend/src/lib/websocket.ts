/**
 * WebSocket client for real-time updates.
 */

type MessageHandler = (data: Record<string, unknown>) => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export class WSClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private url: string;
  private _isConnected = false;

  constructor(path: string = '/ws') {
    this.url = `${WS_URL}${path}`;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', {});
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type as string;
          if (type) {
            this.emit(type, data);
          }
          this.emit('message', data);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this.emit('disconnected', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this._isConnected = false;
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  off(event: string, handler: MessageHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  subscribeToStream(streamId: string): void {
    this.send({ type: 'subscribe_stream', stream_id: streamId });
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch {
        // Ignore handler errors
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton instances
let generalWS: WSClient | null = null;
let alertWS: WSClient | null = null;

export function getGeneralWS(): WSClient {
  if (!generalWS) {
    generalWS = new WSClient('/ws');
  }
  return generalWS;
}

export function getAlertWS(): WSClient {
  if (!alertWS) {
    alertWS = new WSClient('/ws/alerts');
  }
  return alertWS;
}

export function getStreamWS(streamId: string): WSClient {
  return new WSClient(`/ws/stream/${streamId}`);
}
