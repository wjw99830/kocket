'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var net = _interopDefault(require('net'));
var crypto = require('crypto');
var stream = _interopDefault(require('stream'));
var events = require('events');

const SocketMessageTypeMap = new Map().set(1, 'text').set(2, 'bin');
function generateWebsocketAccept(key) {
    const sha1 = crypto.createHash('sha1');
    const magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    sha1.update(key + magic);
    return sha1.digest('base64');
}
function pong(ping) {
    const buf = Buffer.from(ping);
    buf[0] = buf[0] + 1;
    return Uint8Array.from(buf);
}
async function resolveRequest(socket) {
    const data = await new Promise(resolve => {
        socket.once('data', buf => {
            resolve(buf.toString());
        });
    });
    const rows = data.split('\r\n').filter(Boolean);
    const general = rows[0];
    const headers = rows.slice(1);
    const request = {
        headers: {},
    };
    const [method, url, protocol] = general.split(' ').map(keyVal => keyVal.trim());
    request.general = { method, url, protocol, raw: general };
    for (const header of headers) {
        const [key, value] = header.split(':').map(keyOrVal => keyOrVal.trim());
        request.headers[key] = value || '';
    }
    return request;
}
function stringifyHeaders(headers) {
    let str = '';
    for (const [key, value] of Object.entries(headers)) {
        str += `${key}: ${value}\r\n`;
    }
    return str + '\r\n';
}
function decodePayload(payload, maskKey) {
    const length = payload.length;
    const buf = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
        buf[i] = payload[i] ^ maskKey[i % 4];
    }
    return buf;
}
function isWebsocketUpgrade(request) {
    return request.headers['Connection'] === 'Upgrade' && request.headers['Upgrade'] === 'websocket';
}

function toHex(buffer) {
    return parseInt(buffer.toString('hex'));
}

const asyncNoop = async () => { };

class Context {
    constructor(client, meta) {
        this.client = client;
        this.url = meta.general.url;
        const [path, querystring] = this.url.split('?');
        this.path = path;
        this.querystring = querystring;
        this.query = resolveQuery(querystring);
    }
    getText(encoding) {
        return this.message ? this.message.data.toString(encoding) : null;
    }
    getJson() {
        let json;
        try {
            json = JSON.parse(this.getText() || '');
        }
        catch (e) {
            return null;
        }
        return json;
    }
    setName(name) {
        this.name = name;
        return this;
    }
    getBuffer() {
        return this.message ? this.message.data : null;
    }
    send(data) {
        if (Buffer.isBuffer(data)) {
            const header = resolveMessageHeader(data, '0010');
            this.client.write(Buffer.concat([header, data]));
        }
        else if (data instanceof stream.Readable) {
            let buf = Buffer.alloc(0);
            data.on('data', chunk => {
                buf = Buffer.concat([buf, chunk]);
            });
            data.on('end', () => {
                const header = resolveMessageHeader(buf, '0010');
                this.client.write(Buffer.concat([header, buf]));
            });
        }
        else if (typeof data === 'string') {
            const buffer = Buffer.from(data);
            const header = resolveMessageHeader(buffer);
            this.client.write(Buffer.concat([header, buffer]));
        }
        else {
            const buffer = Buffer.from(JSON.stringify(data));
            const header = resolveMessageHeader(buffer);
            this.client.write(Buffer.concat([header, buffer]));
        }
    }
    destroy() {
        this.client.end();
    }
    _setMessage(msg) {
        this.message = msg;
    }
}
function resolveMessageHeader(buffer, opcode = '0001') {
    const length = buffer.length;
    let header = '1000' + opcode;
    if (length < 126) {
        header += length.toString(2).padStart(8, '0');
    }
    else if (length <= Math.pow(2, 15)) {
        header += (126).toString(2).padStart(8, '0');
        header += length.toString(2).padStart(16, '0');
    }
    else if (length <= Math.pow(2, 63)) {
        header += (127).toString(2).padStart(8, '0');
        header += length.toString(2).padStart(64, '0');
    }
    else {
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
function resolveQuery(querystring) {
    const query = {};
    const pairs = querystring.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        query[key] = value;
    }
    return query;
}

class AsyncError extends Error {
    constructor(e) {
        super(e.message);
        const stackArray = (e.stack || '').split('\n');
        stackArray.shift();
        this.stack = `<kocket> AsyncError: ${e.message}\n${stackArray.join('\n')}`;
    }
}

class Kocket extends events.EventEmitter {
    constructor() {
        super();
        this.raw = net.createServer();
        this._middlewares = [];
        this._clients = new Set();
        this._connect(this.raw);
        this.on('error', console.error);
    }
    broadcast(data) {
        for (const client of this._clients) {
            try {
                client.send(data);
            }
            catch (error) {
                this.emit('error', error);
            }
        }
        return this;
    }
    to(name, data) {
        for (const client of this._clients) {
            if (client.name === name) {
                try {
                    client.send(data);
                }
                catch (error) {
                    this.emit('error', error);
                }
            }
        }
        return this;
    }
    use(middleware) {
        this._middlewares.push(middleware);
        return this;
    }
    on(event, handler) {
        super.on(event, handler);
        this.raw.on(event, handler);
        return this;
    }
    listen(port, listeningHandler) {
        this.raw.listen(port, listeningHandler);
        return this;
    }
    _connect(server) {
        server.on('connection', async (client) => {
            client.on('error', console.error);
            const request = await resolveRequest(client);
            if (isWebsocketUpgrade(request)) {
                const handshake = {
                    Upgrade: 'websocket',
                    Connection: 'Upgrade',
                    'Sec-WebSocket-Accept': generateWebsocketAccept(request.headers['Sec-WebSocket-Key'] || ''),
                };
                const response = `${request.general.protocol} 101 Switching Protocols\r\n` + stringifyHeaders(handshake);
                client.write(response);
                this._proxy(client, request);
            }
            else {
                client.end();
            }
        });
    }
    _proxy(client, meta) {
        let payload = Buffer.alloc(0);
        const ctx = new Context(client, meta);
        this._clients.add(ctx);
        client.on('close', () => {
            this._clients.delete(ctx);
        });
        client.on('data', buf => {
            let payloadInThisMessage = Buffer.alloc(0);
            const fin = buf[0] & 0b10000000;
            const opcode = buf[0] & 0b00001111;
            const mask = buf[1] & 0b10000000;
            let payloadLength = buf[1] & 0b01111111;
            let maskKey = Buffer.alloc(4);
            if (payloadLength < 126) {
                maskKey = buf.slice(2, 6);
                payloadInThisMessage = buf.slice(6, 6 + payloadLength);
            }
            else if (payloadLength === 126) {
                payloadLength = toHex(buf.slice(2, 4));
                maskKey = buf.slice(4, 8);
                payloadInThisMessage = buf.slice(8, 8 + payloadLength);
            }
            else if (payloadLength === 127) {
                payloadLength = toHex(buf.slice(2, 10));
                maskKey = buf.slice(10, 14);
                payloadInThisMessage = buf.slice(14, 14 + payloadLength);
            }
            if (mask) {
                payloadInThisMessage = decodePayload(payloadInThisMessage, maskKey);
                switch (opcode) {
                    case 0:
                        payload = Buffer.concat([payload, payloadInThisMessage]);
                        break;
                    case 1:
                    case 2:
                        payload = payloadInThisMessage;
                        break;
                    case 8:
                        client.end();
                        break;
                    case 9:
                        client.write(pong(buf));
                        break;
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
            }
            else {
                client.end();
            }
        });
    }
    _applyMiddlewares(ctx) {
        const nextFns = [];
        const l = this._middlewares.length;
        for (let i = 0; i < l; i++) {
            const next = async () => {
                const nextMiddleware = this._middlewares[i + 1] || asyncNoop;
                await nextMiddleware(ctx, nextFns[i + 1]);
            };
            nextFns.push(next);
        }
        const head = this._middlewares[0] || asyncNoop;
        head(ctx, nextFns[0] || asyncNoop).catch(e => {
            this.emit('async_error', new AsyncError(e));
            this.emit('error', new AsyncError(e));
        });
    }
}

module.exports = Kocket;
