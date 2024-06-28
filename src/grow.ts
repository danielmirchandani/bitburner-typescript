import * as dan from './lib/dan.js';
import type {NS} from '../NetscriptDefinitions.d.ts';

export async function main(ns: NS): Promise<void> {
  const flags = ns.flags([
    ['delay', -1],
    ['server', -1],
    ['target', ''],
  ]);
  if (typeof flags.delay !== 'number') {
    throw new Error(`--delay must be a number, got ${flags.delay}`);
  }
  if (flags.delay < 0) {
    throw new Error(`--delay must be zero or positive, got ${flags.delay}`);
  }
  if (typeof flags.server !== 'number') {
    throw new Error(`--server must be a number, got ${flags.server}`);
  }
  if (typeof flags.target !== 'string') {
    throw new Error(`--target must be a string, got ${flags.target}`);
  }
  if (flags.target === '') {
    throw new Error(`--target must not be empty`);
  }
  await ns.grow(flags.target, {additionalMsec: flags.delay});
  if (flags.server !== -1) {
    dan.writeSignal(ns, flags.server, dan.SIGNAL_STEAL_DONE);
  }
}
