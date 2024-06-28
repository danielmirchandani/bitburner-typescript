import * as dan from './lib/dan.js';
import type {NS} from '../NetscriptDefinitions.d.ts';

export async function main(ns: NS) {
  const flags = ns.flags([['server', -1]]);
  if (typeof flags.server !== 'number') {
    throw new Error(`--server must be a number, got ${flags.server}`);
  }
  await ns.share();
  if (flags.server !== -1) {
    dan.writeSignal(ns, flags.server, dan.SIGNAL_SHARE_DONE);
  }
}
