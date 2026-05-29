import * as dan from './lib/dan.ts';

export async function main(ns: NS) {
  const flags = ns.flags([['pid', -1]]);
  if (typeof flags.pid !== 'number') {
    throw new Error(`--pid must be a number, got ${flags.pid}`);
  }
  dan.writeSignal(ns, flags.pid, dan.SIGNAL_STOP);
}
