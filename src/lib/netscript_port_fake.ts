import type {NetscriptPort} from '../../NetscriptDefinitions.d.ts';

export default class NetscriptPortFake implements NetscriptPort {
  static readonly EMPTY_PORT_VALUE = 'NULL PORT DATA';

  private data: unknown[] = [];
  private resolve: ((value: void | PromiseLike<void>) => void) | null = null;
  private promise: Promise<void>;

  constructor(private readonly limit: number) {
    this.promise = new Promise(resolve => (this.resolve = resolve));
  }

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
    return this.promise;
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
    if (this.resolve !== null) {
      this.resolve();
    }
    this.promise = new Promise(resolve => (this.resolve = resolve));
    return ret;
  }
}
