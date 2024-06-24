import {expect, test} from 'vitest';
import NetscriptPortFake from '../../src/lib/netscript_port_fake.js';

test('new is empty', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
});

test('clear empties', () => {
  const port = new NetscriptPortFake(-1);
  port.write(1);
  port.write('second');
  expect(port.empty()).toBe(false);
  port.clear();
  expect(port.empty()).toBe(true);
});

test('full with limit', () => {
  const port = new NetscriptPortFake(3);
  port.write(1);
  port.write('second');
  expect(port.full()).toBe(false);
  port.write({});
  expect(port.full()).toBe(true);
});

test('nextWrite is a Promise', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  expect(port.nextWrite()).toBeInstanceOf(Promise);
});

test('peek empty', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  expect(port.peek()).toStrictEqual('NULL PORT DATA');
});

test('peek leaves', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  port.write(1);
  port.write('second');
  expect(port.empty()).toBe(false);
  expect(port.peek()).toStrictEqual(1);
  expect(port.empty()).toBe(false);
});

test('read empty', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  expect(port.read()).toStrictEqual('NULL PORT DATA');
});

test('read removes', () => {
  const port = new NetscriptPortFake(-1);
  port.write(1);
  expect(port.empty()).toBe(false);
  port.read();
  expect(port.empty()).toBe(true);
});

test('read/write same', () => {
  const port = new NetscriptPortFake(-1);
  port.write(1);
  expect(port.read()).toStrictEqual(1);
});

test('tryWrite adds', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  port.tryWrite(1);
  expect(port.empty()).toBe(false);
});

test('tryWrite with limit', () => {
  const port = new NetscriptPortFake(2);
  expect(port.tryWrite(1)).toBe(true);
  expect(port.tryWrite('second')).toBe(true);
  expect(port.tryWrite({})).toBe(false);
});

test('write adds', () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  port.write(1);
  expect(port.empty()).toBe(false);
});

test('write resolves nextWrite', async () => {
  const port = new NetscriptPortFake(-1);
  expect(port.empty()).toBe(true);
  const promise = port.nextWrite();
  expect(promise).toBeInstanceOf(Promise);
  let resolved = false;
  promise.then(() => (resolved = true));
  port.write(1);
  await expect(promise).resolves.toBeUndefined();
  expect(resolved).toBe(true);
});

test('write with limit', () => {
  const port = new NetscriptPortFake(2);
  port.write(1);
  port.write('second');
  expect(port.full()).toBe(true);
  expect(port.write({})).toStrictEqual([1]);
  expect(port.full()).toBe(true);
});
