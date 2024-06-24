import type {NS} from '../NetscriptDefinitions.d.ts';

export async function main(ns: NS): Promise<void> {
  ns.tprint(`INFO Current karma: ${ns.heart.break()}`);
}
