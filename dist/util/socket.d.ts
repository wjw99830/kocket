/// <reference types="node" />
import net from 'net';
export declare type Request = {
    general: RequestGeneral;
    headers: RequestHeaders;
};
export declare type RequestGeneral = {
    method: string;
    url: string;
    protocol: string;
    raw: string;
};
export declare type RequestHeaders = Record<string, string | void>;
export declare type SocketMessageTypes = 'text' | 'bin';
export declare const SocketMessageTypeMap: Map<number, SocketMessageTypes>;
export declare type SocketMessage = {
    type: SocketMessageTypes;
    data: Buffer;
};
export declare function generateWebsocketAccept(key: string): string;
export declare function pong(ping: Buffer): Uint8Array;
export declare function resolveRequest(socket: net.Socket): Promise<Request>;
export declare function stringifyHeaders(headers: RequestHeaders): string;
export declare function decodePayload(payload: Buffer, maskKey: Buffer): Buffer;
export declare function isWebsocketUpgrade(request: Request): boolean;
