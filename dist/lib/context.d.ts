/// <reference types="node" />
import { SocketMessage, Request } from "../util/socket";
import net from 'net';
import { Data } from "./server";
declare type Query = Record<string, string | void>;
export declare class Context {
    client: net.Socket;
    url: string;
    path: string;
    querystring: string;
    query: Query;
    userData: any;
    name?: string;
    message?: SocketMessage;
    constructor(client: net.Socket, meta: Request);
    getText(encoding?: string): string | null;
    getJson<T = any>(): T | null;
    setName(name: string): this;
    getBuffer(): Buffer | null;
    send(data: Data): void;
    destroy(): void;
    _setMessage(msg: SocketMessage): void;
}
export {};
