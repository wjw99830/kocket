export type AnyFunction = (...args: any[]) => any;
export type EmptyFunction = () => void;
export type EmptyAsyncFunction = () => Promise<void>;
export const noop = () => {};
export const asyncNoop = async () => {};
