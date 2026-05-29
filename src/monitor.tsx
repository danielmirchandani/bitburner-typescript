import * as dan from './lib/dan.ts';

type Script = {name: string; pid: number; status: string};
type ScriptCallback = (scripts: Readonly<Readonly<Script>[]>) => void;

class ScriptStatus {
  private reactState: Script[] = [];
  private scripts = new Map<number, Script>();
  private callbacks = new Set<ScriptCallback>();

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
      for (const callback of this.callbacks) {
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

  subscribe(callback: ScriptCallback) {
    this.callbacks.add(callback);
  }

  unsubscribe(callback: ScriptCallback) {
    this.callbacks.delete(callback);
  }
}

function ScriptRow({script}: {script: Script}) {
  return (
    <tr>
      <td style={{border: 'solid'}}>{script.name}</td>
      <td style={{border: 'solid', whiteSpace: 'pre-line'}}>{script.status}</td>
    </tr>
  );
}

function ScriptTable({scriptStatus}: {scriptStatus: ScriptStatus}) {
  const [scripts, setScripts] = React.useState(() => scriptStatus.get());
  React.useEffect(() => {
    scriptStatus.subscribe(setScripts);
    return () => scriptStatus.unsubscribe(setScripts);
  }, []);

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
  let keepGoing = true;
  server.registerHandler(dan.SIGNAL_STOP, () => {
    ns.tprint('INFO Got SIGNAL_STOP; quitting after next iteration');
    keepGoing = false;
  });
  ns.disableLog('asleep');

  ns.printRaw(
    <React.StrictMode>
      <ScriptTable scriptStatus={new ScriptStatus(ns, server)} />
    </React.StrictMode>,
  );
  ns.ui.openTail();

  const neverResolves = server.listen();
  while (keepGoing) {
    await Promise.race([ns.asleep(1000), neverResolves]);
  }
}
