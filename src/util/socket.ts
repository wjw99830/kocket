import net from 'net';
import { createHash } from 'crypto';

export type Request = {
  general: RequestGeneral;
  headers: RequestHeaders;
};

export type RequestGeneral = {
  method: string;
  url: string;
  protocol: string;
  raw: string;
};

export type RequestHeaders = Record<string, string | void>;

export type SocketMessageTypes = 'text' | 'bin';
export const SocketMessageTypeMap = new Map<number, SocketMessageTypes>().set(1, 'text').set(2, 'bin');
export type SocketMessage = {
  type: SocketMessageTypes;
  data: Buffer;
};

export function generateWebsocketAccept(key: string) {
  const sha1 = createHash('sha1');
  const magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  sha1.update(key + magic);
  return sha1.digest('base64');
}

export function pong(ping: Buffer): Uint8Array {
  const buf = Buffer.from(ping);
  buf[0] = buf[0] + 1;
  return Uint8Array.from(buf);
}

export async function resolveRequest(socket: net.Socket) {
  const data = await new Promise<string>(resolve => {
    socket.once('data', buf => {
      resolve(buf.toString());
    });
  });
  const rows = data.split('\r\n').filter(Boolean);
  const general = rows[0];
  const headers = rows.slice(1);
  const request: Partial<Request> = {
    headers: {},
  };
  const [method, url, protocol] = general.split(' ').map(keyVal => keyVal.trim());
  request.general = { method, url, protocol, raw: general };
  for (const header of headers) {
    const [key, value] = header.split(':').map(keyOrVal => keyOrVal.trim());
    request.headers![key] = value || '';
  }
  return request as Request;
}

export function stringifyHeaders(headers: RequestHeaders) {
  let str = '';
  for (const [key, value] of Object.entries(headers)) {
    str += `${key}: ${value}\r\n`;
  }
  return str + '\r\n';
}

export function decodePayload(payload: Buffer, maskKey: Buffer) {
  const length = payload.length;
  const buf = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    buf[i] = payload[i] ^ maskKey[i % 4];
  }
  return buf;
}

export function isWebsocketUpgrade(request: Request) {
  return request.headers['Connection'] === 'Upgrade' && request.headers['Upgrade'] === 'websocket';
}
