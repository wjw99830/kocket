export class AsyncError extends Error {
  constructor(e: Error) {
    super(e.message);
    const stackArray = (e.stack || '').split('\n');
    stackArray.shift();
    this.stack = `<kocket> AsyncError: ${e.message}\n${stackArray.join('\n')}`;
  }
}
