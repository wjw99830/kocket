import net from 'net';
import { resolveRequest, isWebsocketUpgrade, generateWebsocketAccept, decodePayload, SocketMessageTypeMap, pong, stringifyHeaders } from '../util/socket';
import { toHex } from '../util/buffer';
import { EmptyFunction, EmptyAsyncFunction, noop } from '../util';
import { Context } from './context';
import stream from 'stream';

export type Data = Buffer | stream.Readable | object | string;
export type SocketEventNames = 'close' | 'connect' | 'data' | 'drain' | 'end' | 'error' | 'lookup' | 'timeout';
export type SocketEventMap = {
  close: (had_error: boolean) => void;
  connect: () => void;
  data: (data: Buffer) => void;
  drain: () => void;
  end: () => void;
  error: (e: Error) => void;
  lookup: (e: Error, address: string, family: string | number, host: string) => void;
  timeout: () => void;
};

export type Middleware = (ctx: Context, n: EmptyAsyncFunction | EmptyFunction) => void;

export class SocketServer {
  public raw = net.createServer();
  private _middlewares: Middleware[] = [];
  private _clients: Set<Context> = new Set();

  constructor() {
    this._connect(this.raw);
    this.on('error', console.error);
  }
  
  public broadcast(data: Data) {
    for (const client of this._clients) {
      client.send(data);
    }
    return this;
  }

  public to(clientName: string, data: Data) {
    for (const client of this._clients) {
      if (client.clientName === clientName) {
        client.send(data);
      }
    }
    return this;
  }

  public use(middleware: Middleware) {
    this._middlewares.push(middleware);
    return this;
  }

  public on<T extends SocketEventNames>(event: T, handler: SocketEventMap[T]) {
    this.raw.on(event, handler);
    return this;
  }

  public listen(port: number, listeningHandler?: EmptyFunction) {
    this.raw.listen(port, listeningHandler);
    return this;
  }

  private _connect(server: net.Server) {
    server.on('connection', async client => {
      client.on('error', console.error);
      const request = await resolveRequest(client);
      if (isWebsocketUpgrade(request)) {
        const handshake = {
          Upgrade: 'websocket',
          Connection: 'Upgrade',
          'Sec-WebSocket-Accept': generateWebsocketAccept(request.headers['Sec-WebSocket-Key'] || ''),
        };
        const response = `${request.general.protocol}/${request.general.version} 101 Switching Protocols\r\n` + stringifyHeaders(handshake);
        client.write(response);
        this._proxy(client);
      } else {
        client.end();
      }
    });
  }

  private _proxy(client: net.Socket) {
    let payload: Buffer = Buffer.alloc(0);
    const ctx = new Context(client);
    this._clients.add(ctx);
    client.on('error', console.error);
    client.on('close', () => {
      this._clients.delete(ctx);
    });
    client.on('data', buf => {
      let payloadInThisMessage                = Buffer.alloc(0);
      const fin                               = buf[0] & 0b10000000;
      const opcode                            = buf[0] & 0b00001111;
      const mask                              = buf[1] & 0b10000000;
      let payloadLength                       = buf[1] & 0b01111111;
      let maskKey                             = Buffer.alloc(4);
      if (payloadLength < 126) {
        maskKey = buf.slice(2, 6);
        payloadInThisMessage = buf.slice(6, 6 + payloadLength);
      } else if (payloadLength === 126) {
        payloadLength = toHex(buf.slice(2, 4));
        maskKey = buf.slice(4, 8);
        payloadInThisMessage = buf.slice(8, 8 + payloadLength);
      } else if (payloadLength === 127) {
        payloadLength = toHex(buf.slice(2, 10));
        maskKey = buf.slice(10, 14);
        payloadInThisMessage = buf.slice(14, 14 + payloadLength);
      }
      if (mask) {
        payloadInThisMessage = decodePayload(payloadInThisMessage, maskKey);
        switch (opcode) {
          case 0: payload = Buffer.concat([payload, payloadInThisMessage]); break;
          case 1: 
          case 2: payload = payloadInThisMessage; break;
          case 8: client.end(); break;
          case 9: client.write(pong(buf)); break;
          default: return;
        }
        if (fin) {
          const type = SocketMessageTypeMap.get(opcode);
          if (type) {
            const message = {
              type,
              data: payload,
            };
            ctx._setMessage(message);
            this._applyMiddlewares(ctx);
          }
          payload = Buffer.alloc(0);
        }
      } else {
        client.end();
      }
    });
  }

  private _applyMiddlewares(ctx: Context) {
    const nextFns: EmptyAsyncFunction[] = [];
    const l = this._middlewares.length;
    for (let i = 0; i < l; i++) {
      const next = async () => {
        const nextMiddleware = this._middlewares[i + 1] || noop;
        await nextMiddleware(ctx, nextFns[i + 1]);
      };
      nextFns.push(next);
    }
    const head = this._middlewares[0] || noop;
    head(ctx, nextFns[0] || noop);
  }

}
