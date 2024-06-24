import type {NS} from '../NetscriptDefinitions.d.ts';
import React from './lib/react.js';

type Script = {name: string; status: string; start: number};
type ScriptCallback = (scripts: Readonly<Readonly<Script>[]>) => void;

class ScriptStatus {
  private scripts: Script[] = [];

  private subscribed = new Map<Symbol, ScriptCallback>();

  get(): Readonly<Readonly<Script>[]> {
    return this.scripts;
  }

  subscribe(key: Symbol, callback: ScriptCallback) {
    this.subscribed.set(key, callback);
    return () => {
      this.subscribed.delete(key);
    };
  }

  update(scripts: Script[]) {
    this.scripts = scripts;
    for (const [, callback] of this.subscribed) {
      callback(this.scripts);
    }
  }
}

function ScriptRow(prop: {script: Script}) {
  return (
    <tr>
      <td style={{border: 'solid'}}>{prop.script.name}</td>
      <td style={{border: 'solid'}}>{prop.script.status}</td>
      <td style={{border: 'solid'}}>{performance.now() - prop.script.start}</td>
    </tr>
  );
}

function ScriptTable(prop: {scriptStatus: ScriptStatus}) {
  const [scripts, setScripts] = React.useState(prop.scriptStatus.get());
  const key = React.useRef(null as Symbol | null);
  if (key.current === null) {
    key.current = Symbol();
  }
  prop.scriptStatus.subscribe(key.current, setScripts);

  return (
    <table style={{borderCollapse: 'collapse', width: '100%'}}>
      <thead>
        <tr>
          <th style={{border: 'solid'}}>Script</th>
          <th style={{border: 'solid'}}>Status</th>
          <th style={{border: 'solid'}}>Runtime</th>
        </tr>
      </thead>
      <tbody>
        {scripts.map(script => (
          <ScriptRow script={script} />
        ))}
      </tbody>
    </table>
  );
}

export async function main(ns: NS): Promise<void> {
  const scriptStatus = new ScriptStatus();
  const scripts = [
    {
      name: 'steal.js',
      status: '0 batches',
      start: performance.now(),
    },
  ];
  scriptStatus.update(scripts);

  ns.tprintRaw(<ScriptTable scriptStatus={scriptStatus} />);

  let counter = 0;
  const start = performance.now();
  while (performance.now() < start + 10_000) {
    scriptStatus.update(
      scripts.map(script => {
        return {...script, status: `${counter} batches`};
      })
    );
    ++counter;
    await ns.sleep(500);
  }
}
