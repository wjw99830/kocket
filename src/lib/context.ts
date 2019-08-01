import { SocketMessage, Request } from "../util/socket";
import net from 'net';
import stream from 'stream';
import { Data } from "./server";

type Query = Record<string, string | void>;

export class Context {
  public url!: string;
  public path!: string;
  public querystring!: string;
  public query!: Query;
  public userData: any;
  public name?: string;
  public message?: SocketMessage;

  constructor(public client: net.Socket, meta: Request) {
    this.url = meta.general.url;
    const [path, querystring] = this.url.split('?');
    this.path = path;
    this.querystring = querystring;
    this.query = resolveQuery(querystring);
  }
  
  public getText(encoding?: string) {
    return this.message ? this.message.data.toString(encoding) : null;
  }

  public getJson<T = any>(): T | null {
    let json: T;
    try {
      json = JSON.parse(this.getText() || '');
    } catch (e) {
      return null;
    }
    return json;
  }

  public setName(name: string) {
    this.name = name;
    return this;
  }

  public getBuffer() {
    return this.message? this.message.data : null;
  }
  
  public send(data: Data) {
    if (Buffer.isBuffer(data)) {
      const header = resolveMessageHeader(data, '0010');
      this.client.write(Buffer.concat([header, data]));
    } else if (data instanceof stream.Readable) {
      let buf = Buffer.alloc(0);
      data.on('data', chunk => {
        buf = Buffer.concat([buf, chunk]);
      });
      data.on('end', () => {
        const header = resolveMessageHeader(buf, '0010');
        this.client.write(Buffer.concat([header, buf]));
      });
    } else if (typeof data === 'string') {
      const buffer = Buffer.from(data);
      const header = resolveMessageHeader(buffer);
      this.client.write(Buffer.concat([header, buffer]));
    } else {
      const buffer = Buffer.from(JSON.stringify(data));
      const header = resolveMessageHeader(buffer);
      this.client.write(Buffer.concat([header, buffer]));
    }
  }

  public destroy() {
    this.client.end();
  }
  
  public _setMessage(msg: SocketMessage) {
    this.message = msg;
  }
}

function resolveMessageHeader(buffer: Buffer, opcode = '0001') {
  const length = buffer.length;
  let header = '1000' + opcode;
  if (length < 126) {
    header += length.toString(2).padStart(8, '0');
  } else if (length <= Math.pow(2, 15)) {
    header += (126).toString(2).padStart(8, '0');
    header += length.toString(2).padStart(16, '0');
  } else if (length <= Math.pow(2, 63)) {
    header += (127).toString(2).padStart(8, '0');
    header += length.toString(2).padStart(64, '0');
  } else {
    header += '0'.repeat(8);
  }
  const buf = Buffer.alloc(Math.ceil(header.length / 8));
  for (let i = 0; i < header.length; i++) {
    if (i % 8 === 0) {
      const index = i / 8;
      buf[index] = parseInt(header.slice(i, i + 8), 2);
    }
  }
  return buf;
}
function resolveQuery(querystring: string) {
  const query: Query = {};
  const pairs = querystring.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    query[key] = value;
  }
  return query;
}
