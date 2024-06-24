import type {NS} from '../NetscriptDefinitions.d.ts';

export async function main(ns: NS) {
  await ns.share();
}
