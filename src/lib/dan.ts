import type {NS, ScriptArg} from '../../NetscriptDefinitions.d.ts';

const PROTOCOL_MAGIC_NUMBER = 84;
export const SIGNAL_STOP = 3;
// export const SIGNAL_NEXT = 4;
export const SIGNAL_HEARTBEAT = 5;
// export const SIGNAL_DONE = 6;
export const SIGNAL_STEAL_DONE = 7;
export const SIGNAL_SHARE_DONE = 8;
export const SIGNAL_STATUS = 9;

export class Flags {
  static readonly SCHEMA: [string, ScriptArg | string[]][] = [
    ['monitor', -1],
    ['n', false],
  ];

  private holder: {[key: string]: ScriptArg | string[]};

  constructor(ns: NS) {
    this.holder = ns.flags(Flags.SCHEMA);
  }

  dryRun() {
    const value = this.holder.n;
    if (typeof value !== 'boolean') {
      throw new Error(`-n must be a boolean, got ${value}`);
    }
    return value;
  }

  monitorPid() {
    const value = this.holder.monitor;
    if (typeof value !== 'number') {
      throw new Error(`--monitor must be a number, got ${value}`);
    }
    return value;
  }
}

export function formatInt(ns: NS, int: number) {
  return ns.formatNumber(int, 1, 1000, true);
}

export class SignalServer {
  private handlers = new Map<number, (clientPid: number) => void>();
  private readonly port;

  public constructor(ns: NS) {
    this.port = ns.getPortHandle(ns.pid);
    this.port.clear();

    ns.setTitle(`${ns.getScriptName()} - ${ns.pid}`);
  }

  /**
   * Get the next available signal and call that signal's handler, then repeat.
   *
   * The returned `Promise` will never resolve, but must still be awaited (for
   * example, with `Promise.race()`) for this to progress.
   */
  async listen(): Promise<void> {
    const magic = await this.nextRead();
    if (magic !== PROTOCOL_MAGIC_NUMBER) {
      throw new Error(`Server requires magic number, got ${magic}`);
    }
    const clientPid = await this.nextRead();
    if (typeof clientPid !== 'number') {
      throw new Error(`Server requires client's PID, got ${clientPid}`);
    }
    const signal = await this.nextRead();
    if (typeof signal !== 'number') {
      throw new Error(`Server requires signal, got ${signal}`);
    }
    const handler = this.handlers.get(signal);
    if (handler === undefined) {
      throw new Error(`Don't know how to handle signal ${signal}`);
    }
    handler(clientPid);
    return this.listen();
  }

  private async nextRead() {
    if (this.port.empty()) {
      await this.port.nextWrite();
    }
    return this.port.read();
  }

  registerHandler(signal: number, handler: (clientPid: number) => void) {
    this.handlers.set(signal, handler);
  }

  unregisterHandler(signal: number) {
    return this.handlers.delete(signal);
  }
}

export class Stopwatch {
  private readonly start: number;

  constructor(private readonly ns: NS) {
    this.start = performance.now();
  }

  getElapsed() {
    return performance.now() - this.start;
  }

  toString() {
    return `${this.ns.formatNumber(this.getElapsed(), 1)}ms`;
  }
}

export function updateStatus(ns: NS, flags: Flags, status: string) {
  if (flags.monitorPid() !== -1) {
    ns.write(`run/${ns.pid}.txt`, status, 'w');
    writeSignal(ns, flags.monitorPid(), SIGNAL_STATUS);
  } else {
    ns.print(`INFO ${status}`);
  }
}

export function writeSignal(ns: NS, serverPId: number, signal: number) {
  const port = ns.getPortHandle(serverPId);
  if (
    !port.tryWrite(PROTOCOL_MAGIC_NUMBER) ||
    !port.tryWrite(ns.pid) ||
    !port.tryWrite(signal)
  ) {
    throw new Error('ERROR Ran out of space to write next signal');
  }
}
