import {expect, test, vi} from 'vitest';
import type {NS} from '../../NetscriptDefinitions.d.ts';
import * as dan from '../../src/lib/dan.js';
import NetscriptPortFake from '../../src/lib/netscript_port_fake.js';

test('main runs dry-run once', async () => {
  const getPortHandle = vi.fn().mockReturnValue(new NetscriptPortFake(-1));
  const iteration = vi.fn();
  const ns = {
    flags: (() => {
      return {n: true};
    }) as NS['flags'],
    getPortHandle: getPortHandle as NS['getPortHandle'],
    pid: 42,
    tprint: (() => {}) as NS['tprint'],
  } as NS;

  await expect(dan.main(iteration, ns)).resolves.toBeUndefined();

  expect(getPortHandle).toHaveBeenCalledTimes(1);
  expect(getPortHandle).toHaveBeenCalledWith(42);
  expect(iteration).toHaveBeenCalledTimes(1);
});

test('main stops when signalled', async () => {
  const getPortHandle = vi.fn().mockReturnValue(new NetscriptPortFake(-1));
  const iteration = vi.fn(() => Promise.resolve());
  const ns = {
    flags: (() => {
      return {n: false};
    }) as NS['flags'],
    getPortHandle: getPortHandle as NS['getPortHandle'],
    pid: 42,
    tprint: (() => {}) as NS['tprint'],
  } as NS;

  const promise = dan.main(iteration, ns);
  dan.writeSignal(ns, 42, dan.SIGNAL_STOP);
  await expect(promise).resolves.toBeUndefined();

  // Once for `loop`, once for `writeSignal`
  expect(getPortHandle).toHaveBeenCalledTimes(2);
  expect(getPortHandle).toHaveBeenCalledWith(42);
  // The time to notice the promise is resolved isn't predictable, but we know
  // the test won't get to writing the signal without looping once.
  expect(iteration).toHaveBeenCalled();
});
