/// <reference types="node" />
import net from 'net';
import { EmptyFunction, EmptyAsyncFunction, AnyFunction } from '../util';
import { Context } from './context';
import stream from 'stream';
import { EventEmitter } from 'events';
export declare type Data = Buffer | stream.Readable | object | string;
export declare type SocketEventNames = 'close' | 'connect' | 'data' | 'drain' | 'end' | 'error' | 'lookup' | 'timeout';
export declare type SocketEventMap = {
    close: (had_error: boolean) => void;
    connect: () => void;
    data: (data: Buffer) => void;
    drain: () => void;
    end: () => void;
    error: (e: Error) => void;
    lookup: (e: Error, address: string, family: string | number, host: string) => void;
    timeout: () => void;
};
export declare type Middleware = (ctx: Context, n: EmptyAsyncFunction | EmptyFunction) => Promise<void>;
export declare class Kocket extends EventEmitter {
    raw: net.Server;
    private _middlewares;
    private _clients;
    constructor();
    broadcast(data: Data): this;
    to(name: string, data: Data): this;
    use(middleware: Middleware): this;
    on(event: string, handler: AnyFunction): this;
    listen(port: number, listeningHandler?: EmptyFunction): this;
    private _connect;
    private _proxy;
    private _applyMiddlewares;
}
