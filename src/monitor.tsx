import * as dan from './lib/dan.js';
import type {NS} from '../NetscriptDefinitions.d.ts';
import React from './lib/react.js';

type Script = {name: string; pid: number; status: string};
type ScriptCallback = (scripts: Readonly<Readonly<Script>[]>) => void;

class ScriptStatus {
  private reactState: Script[] = [];
  private scripts = new Map<number, Script>();
  private callbacks = new Map<any, ScriptCallback>();

  constructor(ns: NS, server: dan.SignalServer) {
    server.registerHandler(dan.SIGNAL_STATUS, (clientPid: number) => {
      const script = {
        name: this.scriptName(ns, clientPid),
        pid: clientPid,
        status: ns.read(`run/${clientPid}.txt`),
      };
      this.scripts.set(clientPid, script);
      // React needs this to be a new instance to detect the change.
      this.reactState = Array.from(this.scripts.values());
      for (const [, callback] of this.callbacks) {
        callback(this.reactState);
      }
    });
  }

  get(): Readonly<Readonly<Script>[]> {
    return this.reactState;
  }

  private scriptName(ns: NS, pid: number) {
    const oldScript = this.scripts.get(pid);
    if (oldScript !== undefined) {
      return oldScript.name;
    }
    const running = ns.getRunningScript(pid);
    if (running !== null) {
      return `${running.filename} - ${pid}`;
    }
    return `${pid}`;
  }

  subscribe(key: any, callback: ScriptCallback) {
    this.callbacks.set(key, callback);
  }

  unsubscribe(key: any) {
    this.callbacks.delete(key);
  }
}

function ScriptRow(prop: {script: Script}) {
  return (
    <tr>
      <td style={{border: 'solid'}}>{prop.script.name}</td>
      <td style={{border: 'solid', whiteSpace: 'pre-line'}}>
        {prop.script.status}
      </td>
    </tr>
  );
}

function ScriptTable(prop: {scriptStatus: ScriptStatus}) {
  const key = React.useRef<Symbol | null>(null);
  if (key.current === null) {
    key.current = Symbol();
  }

  const [scripts, setScripts] = React.useState(
    prop.scriptStatus.get.bind(prop.scriptStatus)
  );
  React.useEffect(() => {
    prop.scriptStatus.subscribe(key.current, setScripts);
    return prop.scriptStatus.unsubscribe.bind(prop.scriptStatus, key.current);
  }, [prop.scriptStatus, key, setScripts]);

  return (
    <table style={{borderCollapse: 'collapse', width: '100%'}}>
      <thead>
        <tr>
          <th style={{border: 'solid'}}>Script</th>
          <th style={{border: 'solid'}}>Status</th>
        </tr>
      </thead>
      <tbody>
        {scripts.map(script => (
          <ScriptRow key={script.pid} script={script} />
        ))}
      </tbody>
    </table>
  );
}

export async function main(ns: NS): Promise<void> {
  const server = new dan.SignalServer(ns);
  ns.printRaw(<ScriptTable scriptStatus={new ScriptStatus(ns, server)} />);
  ns.tail();
  // Wait forever while the signal handler above does all the actual work.
  await server.listen();
}
