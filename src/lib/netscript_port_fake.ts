import type {NetscriptPort} from '../../NetscriptDefinitions.d.ts';

export default class NetscriptPortFake implements NetscriptPort {
  static readonly EMPTY_PORT_VALUE = 'NULL PORT DATA';

  private data: unknown[] = [];
  private writeCallbacks: ((value: void | PromiseLike<void>) => void)[] = [];

  constructor(private readonly limit: number) {}

  clear() {
    this.data = [];
  }

  empty() {
    return this.data.length === 0;
  }

  full() {
    if (this.limit === -1) {
      return false;
    }
    return this.data.length === this.limit;
  }

  nextWrite() {
    return new Promise<void>(resolve => {
      this.writeCallbacks.push(resolve);
    });
  }

  peek() {
    if (this.data.length === 0) {
      return NetscriptPortFake.EMPTY_PORT_VALUE;
    }
    return this.data[0];
  }

  read() {
    if (this.data.length === 0) {
      return NetscriptPortFake.EMPTY_PORT_VALUE;
    }
    return this.data.shift();
  }

  tryWrite(value: unknown) {
    if (this.full()) {
      return false;
    }
    this.write(value);
    return true;
  }

  write(value: unknown) {
    const ret = [];
    while (this.full()) {
      ret.push(this.read());
    }
    this.data.push(value);
    // Create a new callback array before any callbbacks in case any of those
    // callbacks add new callbacks.
    const callbacks = this.writeCallbacks;
    this.writeCallbacks = [];
    for (const callback of callbacks) {
      callback();
    }
    return ret;
  }
}
