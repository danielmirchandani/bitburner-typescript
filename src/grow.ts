import type {NS} from '../NetscriptDefinitions.d.ts';

export async function main(ns: NS): Promise<void> {
  const flags = ns.flags([
    ['delay', -1],
    ['target', ''],
  ]);
  if (typeof flags.delay !== 'number') {
    throw new Error(`--delay must be a number, got ${flags.delay}`);
  }
  if (typeof flags.target !== 'string') {
    throw new Error(`--target must be a string, got ${flags.target}`);
  }
  await ns.grow(flags.target, {additionalMsec: flags.delay});
}
