import type {NS, ScriptArg} from '../../NetscriptDefinitions.d.ts';

const PROTOCOL_MAGIC_NUMBER = 84;
export const SIGNAL_STOP = 3;
export const SIGNAL_HEARTBEAT = 5;

export class Flags {
  static readonly SCHEMA: [string, ScriptArg | string[]][] = [['n', false]];

  private holder: {[key: string]: ScriptArg | string[]};

  constructor(ns: NS) {
    this.holder = ns.flags(Flags.SCHEMA);
  }

  dryRun() {
    const value = this.holder.n;
    if (typeof value !== 'boolean') {
      throw new Error(`Dry-run flag must be a boolean, got ${value}`);
    }
    return value;
  }
}

export function formatInt(ns: NS, int: number) {
  return ns.formatNumber(int, 1, 1000, true);
}

export async function main(
  iteration: (ns: NS, flags: Flags) => Promise<void>,
  ns: NS
) {
  const flags = new Flags(ns);
  ns.tprint(`INFO dry-run: ${Boolean(flags.dryRun())}`);
  const server = new SignalServer(ns);
  server.nextSignal().then(server.dispatch.bind(server));
  while (!server.getSignalledStop()) {
    await iteration(ns, flags);
    if (flags.dryRun()) {
      return;
    }
  }
}

class SignalServer {
  private handlers = new Map<number, () => void>();
  private readonly port;
  private signalledStop = false;

  public constructor(ns: NS) {
    this.handlers.set(SIGNAL_STOP, () => {
      this.signalledStop = true;
    });
    this.port = ns.getPortHandle(ns.pid);
    this.port.clear();
  }

  dispatch(signal: number) {
    const handler = this.handlers.get(signal);
    if (handler === undefined) {
      throw new Error(`Don't know how to handle signal ${signal}`);
    }
    handler();
    this.nextSignal().then(this.dispatch.bind(this));
  }

  getSignalledStop(): boolean {
    return this.signalledStop;
  }

  private async nextRead() {
    if (this.port.empty()) {
      await this.port.nextWrite();
    }
    return this.port.read();
  }

  async nextSignal() {
    const magic = await this.nextRead();
    if (magic !== PROTOCOL_MAGIC_NUMBER) {
      throw new Error(`Server requires magic number, got ${magic}`);
    }
    const clientPId = await this.nextRead();
    if (typeof clientPId !== 'number') {
      throw new Error(`Server requires client's PID, got ${clientPId}`);
    }
    const signal = await this.nextRead();
    if (typeof signal !== 'number') {
      throw new Error(`Server requires signal, got ${signal}`);
    }
    return signal;
  }

  registerHandler(signal: number, handler: () => void) {
    const previous = this.handlers.get(signal);
    if (previous === undefined) {
      this.handlers.set(signal, handler);
    } else if (previous !== handler) {
      throw new Error(`${signal} already handled by ${previous.name}`);
    }
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
