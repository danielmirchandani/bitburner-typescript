import * as dan from './lib/dan.ts';
import {PORTS} from './lib/server_ports.ts';

const BATCH_LIMIT = 100_000;
const SECURITY_PER_GROW = 0.004;
const SECURITY_PER_HACK = 0.002;
const SECURITY_PER_WEAKEN = 0.05;
const WEAKENS_PER_GROW = SECURITY_PER_GROW / SECURITY_PER_WEAKEN;
const WEAKENS_PER_HACK = SECURITY_PER_HACK / SECURITY_PER_WEAKEN;

function bestTarget(ns: NS, player: Player, servers: Required<Server>[]) {
  const hasFormulas = ns.fileExists('Formulas.exe');

  let bestEfficiency = 0;
  let bestTarget = null;
  for (const target of servers) {
    if (!target.hasAdminRights) {
      continue;
    }
    if (target.moneyMax === 0) {
      continue;
    }

    // TODO: what hostname should these use?
    const ramPerGrow = ns.getScriptRam('grow.ts', target.hostname);
    const ramPerHack = ns.getScriptRam('hack.ts', target.hostname);
    const ramPerWeaken = ns.getScriptRam('weaken.ts', target.hostname);

    // These are as if the server is fully grown and weakened.
    let chance;
    let grows;
    let percent: number;
    let time: number;
    if (hasFormulas) {
      const scratch = {...target};
      scratch.hackDifficulty = target.minDifficulty;
      scratch.moneyAvailable = target.moneyMax;
      chance = ns.formulas.hacking.hackChance(scratch, player);
      percent = ns.formulas.hacking.hackPercent(scratch, player);
      time = Math.max(
        ns.formulas.hacking.growTime(scratch, player),
        ns.formulas.hacking.hackTime(scratch, player),
        ns.formulas.hacking.weakenTime(scratch, player),
      );
    } else {
      // These aren't anywhere close to the right values, but
      // they're in the right ballpark long enough to get access
      // to Formulas.exe.
      chance = 1 / target.requiredHackingSkill;
      percent = target.minDifficulty;
      time = target.minDifficulty;
    }
    // Reduction of:
    // target.moneyMax / (percent * target.moneyMax * chance);
    const hacks = 1 / (percent * chance);
    if (hasFormulas) {
      const scratch = {...target};
      scratch.hackDifficulty = target.minDifficulty;
      scratch.moneyAvailable = 0;
      grows = ns.formulas.hacking.growThreads(scratch, player, target.moneyMax);
    } else {
      grows = hacks / target.serverGrowth;
    }
    // money/s = batches * money/batch / s/batch
    // batches = RAM / RAM/batch
    // money/batch = server.moneyMax
    // s/batch = max(s/hack, s/weaken, s/grow)
    // RAM/batch =
    //     hacks * RAM/hack + grows * RAM/grow + weakens * RAM/weaken
    // hacks = server.moneyMax / ($/hack * chance)
    // grows ???= hacks / server.serverGrowth
    // weakens = hacks * WEAKENS_PER_HACK + grows * WEAKENS_PER_GROW
    const weakens =
      Math.ceil(hacks * WEAKENS_PER_HACK) + Math.ceil(grows * WEAKENS_PER_GROW);
    const ramPerBatch =
      hacks * ramPerHack + grows * ramPerGrow + weakens * ramPerWeaken;
    const efficiency = target.moneyMax / (ramPerBatch * time);
    if (efficiency > bestEfficiency) {
      bestEfficiency = efficiency;
      bestTarget = target;
    }
  }
  if (bestTarget === null) {
    throw new Error('Could not find best target');
  }
  return bestTarget;
}

export function exponentialSearch(
  start: number,
  predicate: (_: number) => boolean,
): number {
  if (start === 0) {
    throw new Error('Cannot start exponential search at 0');
  }
  if (!predicate(start)) {
    return 0;
  }
  let current = start;
  let end = -1;
  while (end === -1 || current + 1 < end) {
    const step = end === -1 ? current : Math.floor((end - current) / 2);
    if (predicate(current + step)) {
      current += step;
    } else {
      end = current + step;
    }
  }
  return current;
}

export class Host {
  private constructor(
    readonly server: Readonly<Required<Server>>,
    readonly cpuCores: number,
    readonly hostname: string,
    public ramAvailable: number,
    private readonly scriptRamCache: Map<string, number>,
  ) {}

  copy() {
    return new Host(
      this.server,
      this.cpuCores,
      this.hostname,
      this.ramAvailable,
      // For the same host, scripts use the same RAM, so sharing the cache
      // is actually a benefit.
      this.scriptRamCache,
    );
  }

  static fromServer(ns: NS, server: Required<Server>) {
    return new Host(
      server,
      server.cpuCores,
      server.hostname,
      server.hostname === 'home'
        ? Math.max(server.maxRam - server.ramUsed - 256, 0)
        : server.maxRam - server.ramUsed,
      new Map(),
    );
  }

  getScriptRam(ns: NS, script: string) {
    let ram = this.scriptRamCache.get(script);
    if (ram === undefined) {
      ram = ns.getScriptRam(script, this.hostname);
      if (ram === 0) {
        throw new Error(
          `${script} is either missing from ${this.hostname} or doesn't compile`,
        );
      }
      this.scriptRamCache.set(script, ram);
    }
    return ram;
  }
}

export function growPercentSearch(
  ns: NS,
  target: Required<Server>,
  host: Readonly<Host>,
  threads: number,
) {
  if (threads < 1) {
    throw new Error(`${threads} must be at least 1`);
  }
  if (!Number.isInteger(threads)) {
    throw new Error(`${threads} must be an integer`);
  }
  if (target.moneyAvailable < 1) {
    throw new Error(`"${target.hostname}" must have at least $1`);
  }

  let lastMoney = 0;
  let multiplierBottom = 1;
  let multiplierTop = -1;
  let multiplier = 1;
  for (let i = 0; i < 100; ++i) {
    const threadsSearch = ns.growthAnalyze(
      target.hostname,
      multiplier,
      host.cpuCores,
    );
    if (threadsSearch < threads) {
      multiplierBottom = multiplier;
    } else if (threadsSearch > threads) {
      multiplierTop = multiplier;
    }
    if (multiplierTop === -1) {
      multiplier *= 2;
    } else {
      multiplier = (multiplierBottom + multiplierTop) / 2;
    }
    // Money is an integer, so we only need to be precise enough that
    // further iterations won't change how much money we expect to have.
    const nextMoney = Math.trunc(target.moneyAvailable * multiplier);
    if (lastMoney === nextMoney) {
      break;
    }
    lastMoney = nextMoney;
  }
  return multiplier;
}

export class Plan {
  private _awaits = 0;
  private _batches: number = 0;
  private _debugStrings = new Map<string, number>();
  private _hacks: number = 0;
  private scripts: Readonly<Script>[][] = [];

  constructor(
    readonly player: Readonly<Player>,
    private hosts: Readonly<Host>[],
    private _target: Readonly<Required<Server>>,
    readonly multiplierHack: number,
    private timeGrow: number,
    private timeHack: number,
    private timeWeaken: number,
    readonly hasFormulas: boolean,
  ) {}

  get awaits() {
    return this._awaits;
  }

  get batches() {
    return this._batches;
  }

  get debugStrings(): ReadonlyMap<string, number> {
    return this._debugStrings;
  }

  get hacks() {
    return this._hacks;
  }

  get target() {
    return this._target;
  }

  /**
   * Figure out the "ideal" number of hacks per HWGW batch.
   *
   * In reality, batches don't use the same RAM because, even for the same number
   * of hacks, grows increase as the hosts they're split between increase. The
   * slight loss in efficiency per batch (~10%) is more than made up for by
   * planning _far_ more batches (10x for me) in the same amount of planning time.
   */
  calculateHacksPerBatch(ns: NS) {
    // Any threads beyond this will have no money to steal, so efficiency only
    // goes down after this.
    const limit = Math.floor(1 / this.multiplierHack);
    if (limit > 1_000_000) {
      ns.tprint(
        'WARNING Hacking would steal too little or no money; try weakening the target manually and restarting this script',
      );
      this._hacks = -1;
      return;
    }

    const worstHost = this.hosts[0];

    let bestEfficiency = 0;
    for (let i = 1; i <= limit; ++i) {
      const weakensHack = Math.ceil(WEAKENS_PER_HACK * i);
      const grows = this.growThreads(ns, this.target, worstHost);
      const weakensGrow = Math.ceil(WEAKENS_PER_GROW * grows);
      // All hosts have the same copy of the script (see `rootServers`) so use
      // any host convenient to calculate RAM costs.
      const ramLowerBound =
        i * worstHost.getScriptRam(ns, 'hack.ts') +
        weakensHack * worstHost.getScriptRam(ns, 'weaken.ts') +
        grows * worstHost.getScriptRam(ns, 'grow.ts') +
        weakensGrow * worstHost.getScriptRam(ns, 'weaken.ts');

      // All plans have the same wait, so we don't need to consider it.
      const moneyPossible = this.multiplierHack * i;
      const money = Math.min(moneyPossible, this.target.moneyAvailable);
      const numBatches = Math.min(
        this.getRamAvailable() / ramLowerBound,
        BATCH_LIMIT,
      );
      const efficiency = money * numBatches;
      if (efficiency <= bestEfficiency) {
        continue;
      }
      bestEfficiency = efficiency;
      this._hacks = i;
    }
  }

  async exec(
    ns: NS,
    server: dan.SignalServer,
    updateStatus: (key: string, value: string) => void,
  ) {
    const durationMax = this.scripts.reduce(
      (max, scripts) =>
        Math.max(
          max,
          scripts.reduce((max, current) => Math.max(max, current.duration), 0),
        ),
      0,
    );
    const shareScript = 'share.ts';

    let keepGoing = true;
    let sharePids: number[] = [];

    const planDone = new Promise<number>(resolve => {
      server.registerHandler(dan.SIGNAL_STEAL_DONE, resolve);
    }).then(() => {
      server.unregisterHandler(dan.SIGNAL_STEAL_DONE);
      keepGoing = false;
    });

    let execCount = 0;
    const stopwatchExec = new dan.Stopwatch();
    let lastSleep = performance.now();
    for (let i = 0; i < this.scripts.length; ++i) {
      for (let j = 0; j < this.scripts[i].length; ++j) {
        ++execCount;
        if (performance.now() > lastSleep + 20) {
          updateStatus('Exec', `${execCount} (${stopwatchExec.format(ns)})`);
          await ns.asleep(0);
          lastSleep = performance.now();
        }
        this.scripts[i][j].exec(
          ns,
          this.target,
          durationMax,
          i === this.scripts.length - 1 && j === this.scripts[i].length - 1,
        );
      }
    }
    updateStatus('Exec', `${execCount} (${stopwatchExec.format(ns)})`);

    let shares = 0;
    const stopwatchWait = new dan.Stopwatch();
    while (keepGoing) {
      const duration = durationMax - stopwatchWait.getElapsed();
      updateStatus('Left', ns.format.time(duration));

      const shareDone = new Promise<number>(resolve => {
        server.registerHandler(dan.SIGNAL_SHARE_DONE, resolve);
      }).then(() => {
        server.unregisterHandler(dan.SIGNAL_SHARE_DONE);
        ++shares;
        updateStatus('Shares', `${shares}`);
      });

      const shareHosts: [Readonly<Host>, number][] = [];
      for (const host of this.hosts) {
        const ramPerThread = host.getScriptRam(ns, shareScript);
        const threads = Math.floor(host.ramAvailable / ramPerThread);
        if (threads === 0) {
          continue;
        }
        shareHosts.push([host, threads]);
      }

      sharePids = [];
      for (let i = 0; i < shareHosts.length; ++i) {
        const [host, threads] = shareHosts[i];
        sharePids.push(
          ns.exec(
            shareScript,
            host.hostname,
            {temporary: true, threads: threads},
            `--server=${i !== shareHosts.length - 1 ? -1 : ns.pid}`,
          ),
        );
      }
      await Promise.race([planDone, shareDone]);
    }
    for (const pid of sharePids) {
      ns.kill(pid);
    }
  }

  getRamAvailable() {
    return this.hosts.reduce((sum, host) => sum + host.ramAvailable, 0);
  }

  growAmount(
    ns: NS,
    target: Readonly<Required<Server>>,
    grows: number,
    host: Readonly<Host>,
  ) {
    if (this.hasFormulas) {
      return ns.formulas.hacking.growAmount(
        target,
        this.player,
        grows,
        host.cpuCores,
      );
    } else {
      return Math.min(
        target.moneyAvailable * growPercentSearch(ns, target, host, grows),
        target.moneyMax,
      );
    }
  }

  growThreads(
    ns: NS,
    target: Readonly<Required<Server>>,
    host: Readonly<Host>,
  ) {
    if (this.hasFormulas) {
      return ns.formulas.hacking.growThreads(
        target,
        this.player,
        target.moneyMax,
        host.cpuCores,
      );
    } else {
      const multiplier =
        target.moneyAvailable > 0
          ? target.moneyMax / target.moneyAvailable
          : 1;
      return Math.ceil(
        ns.growthAnalyze(target.hostname, multiplier, host.cpuCores)
      );
    }
  }

  transaction(): PlanTransaction {
    return {
      batches: 0,
      debugStrings: new Map(),
      hosts: this.hosts.map(host => host.copy()),
      plan: this,
      scripts: [],
      target: {...this.target},

      addDebugString(key: string) {
        dan.mapIncrement(this.debugStrings, key, 1);
      },

      commit() {
        this.plan._awaits += this.scripts.reduce(
          (sum, script) => sum + script.threads.length,
          0,
        );
        this.plan._batches += this.batches;
        this.debugStrings.forEach((value, key) => {
          dan.mapIncrement(this.plan._debugStrings, key, value);
        });
        this.plan.hosts = this.hosts;
        this.plan.scripts.push(this.scripts);
        this.plan._target = this.target;
        return this.plan;
      },

      newGrow() {
        const script = new Script('grow.ts', this.plan.timeGrow);
        this.scripts.push(script);
        return script;
      },

      newHack() {
        const script = new Script('hack.ts', this.plan.timeHack);
        this.scripts.push(script);
        return script;
      },

      newWeaken() {
        const script = new Script('weaken.ts', this.plan.timeWeaken);
        this.scripts.push(script);
        return script;
      },
    };
  }
}

interface PlanTransaction {
  batches: number;
  debugStrings: Map<string, number>;
  hosts: Host[];
  plan: Plan;
  scripts: Script[];
  target: Required<Server>;

  addDebugString(key: string): void;
  commit(): Plan;
  newGrow(): Script;
  newHack(): Script;
  newWeaken(): Script;
}

function planBase(
  ns: NS,
  player: Player,
  hosts: Readonly<Host>[],
  target: Required<Server>,
): Plan {
  const plan = new Plan(
    player,
    hosts,
    target,
    ns.hackAnalyze(target.hostname),
    ns.getGrowTime(target.hostname),
    ns.getHackTime(target.hostname),
    ns.getWeakenTime(target.hostname),
    ns.fileExists('Formulas.exe'),
  );
  plan.calculateHacksPerBatch(ns);
  return plan;
}

function planGrow(ns: NS, grows: number, plan: Plan) {
  const txn = plan.transaction();

  const scriptGrow = txn.newGrow();
  let growsLeft = grows;
  for (let i = txn.hosts.length - 1; i >= 0 && growsLeft > 0; --i) {
    const host = txn.hosts[i];
    const growsWanted = plan.growThreads(ns, txn.target, host);
    if (growsWanted < growsLeft) {
      return null;
    }
    const grows = scriptGrow.reserveThreadsOnHost(ns, growsWanted, host);
    if (grows === 0) {
      continue;
    }
    growsLeft -= grows;
    txn.target.moneyAvailable = plan.growAmount(ns, txn.target, grows, host);
  }
  if (growsLeft > 0) {
    return null;
  }

  const scriptWeaken = txn.newWeaken();
  const weakens = Math.ceil(grows * WEAKENS_PER_GROW);
  if (
    scriptWeaken.reserveThreadsFromStart(ns, weakens, txn.hosts) !== weakens
  ) {
    return null;
  }

  txn.addDebugString(`${grows} grow, ${weakens} weaken`);
  return txn;
}

export function planHWGW(ns: NS, hacks: number, plan: Plan): Plan | null {
  const txn = plan.transaction();

  const scriptHack = txn.newHack();
  if (scriptHack.reserveThreadsFromStart(ns, hacks, txn.hosts) !== hacks) {
    return null;
  }
  const money = txn.target.moneyMax * plan.multiplierHack * hacks;
  txn.target.moneyAvailable -= Math.min(money, txn.target.moneyAvailable);

  const scriptHackWeaken = txn.newWeaken();
  const weakensHackWanted = Math.ceil(WEAKENS_PER_HACK * hacks);
  const weakensHack = scriptHackWeaken.reserveThreadsFromStart(
    ns,
    weakensHackWanted,
    txn.hosts,
  );
  if (weakensHack !== weakensHackWanted) {
    return null;
  }

  const scriptGrow = txn.newGrow();
  let growsTotal = 0;
  for (
    let i = txn.hosts.length - 1;
    i >= 0 && txn.target.moneyAvailable < txn.target.moneyMax;
    --i
  ) {
    const host = txn.hosts[i];
    const growsWanted = plan.growThreads(ns, txn.target, host);
    const grows = scriptGrow.reserveThreadsOnHost(ns, growsWanted, host);
    if (grows === 0) {
      continue;
    }
    growsTotal += grows;
    txn.target.moneyAvailable = plan.growAmount(ns, txn.target, grows, host);
  }
  if (txn.target.moneyAvailable < txn.target.moneyMax) {
    return null;
  }

  const scriptGrowWeaken = txn.newWeaken();
  const weakensGrowWanted = Math.ceil(WEAKENS_PER_GROW * growsTotal);
  const weakensGrow = scriptGrowWeaken.reserveThreadsFromStart(
    ns,
    weakensGrowWanted,
    txn.hosts,
  );
  if (weakensGrow !== weakensGrowWanted) {
    return null;
  }

  txn.batches += 1;
  txn.addDebugString(
    `${hacks} hack, ${weakensHack} weaken, ${growsTotal} grow, ${weakensGrow} weaken`,
  );
  return txn.commit();
}

export function planPrep(ns: NS, plan: Plan): Plan {
  const txn = plan.transaction();

  const securityWeakenInitial =
    txn.target.hackDifficulty - txn.target.minDifficulty;
  if (securityWeakenInitial > 0) {
    const scriptWeaken = txn.newWeaken();
    const weakensWanted = Math.ceil(
      securityWeakenInitial / SECURITY_PER_WEAKEN,
    );
    // Take all the weakens we can get, but bail early if we couldn't get
    // all of them so the next iteration can keep prepping.
    const weakens = scriptWeaken.reserveThreadsFromStart(
      ns,
      weakensWanted,
      txn.hosts,
    );
    txn.target.hackDifficulty -= SECURITY_PER_WEAKEN * weakens;

    txn.addDebugString(`${weakens} weaken`);
    if (weakens !== weakensWanted) {
      return txn.commit();
    }
  }

  // `growthAnalyze` error is too large for us for multipliers this large.
  if (!plan.hasFormulas && txn.target.moneyAvailable <= 1) {
    ns.tprint(
      `ERROR "${txn.target.hostname}" < $1; if this repeats, stop the script.`,
    );

    const scriptGrow = txn.newGrow();
    const grows = scriptGrow.reserveThreadsOnHost(
      ns,
      Number.POSITIVE_INFINITY,
      txn.hosts[txn.hosts.length - 1],
    );

    const scriptWeaken = txn.newWeaken();
    const weakens = scriptWeaken.reserveThreadsFromStart(
      ns,
      Math.ceil(grows * WEAKENS_PER_GROW),
      txn.hosts,
    );

    txn.addDebugString(`${grows} grow, ${weakens} weaken`);
    return txn.commit();
  }

  txn.commit();

  const plansGrow: PlanTransaction[] = [];
  const grows = exponentialSearch(1, threads => {
    const maybePlan = planGrow(ns, threads, plan);
    if (maybePlan !== null) {
      plansGrow[threads] = maybePlan;
      return true;
    } else {
      return false;
    }
  });
  if (grows > 0) {
    return plansGrow[grows].commit();
  } else {
    return plan;
  }
}

function purchaseServers(
  ns: NS,
  player: Player,
  updateStatus: (key: string, value: string) => void,
) {
  const limit = ns.cloud.getServerLimit();
  let ram = 2;
  for (let i = ns.cloud.getServerNames().length; i < limit; ++i) {
    const cost = ns.cloud.getServerCost(ram);
    if (cost > player.money) {
      updateStatus(
        'Cloud servers',
        `${i - 1}/${limit}, ($${ns.format.number(cost)})`,
      );
      return;
    }
    ns.cloud.purchaseServer('home', ram);
    player.money -= cost;
  }
  updateStatus('Cloud servers', `${limit} (MAX)`);

  const max = ns.cloud.getRamLimit();
  let nextRam = ram * 2;
  while (nextRam <= max) {
    for (const hostname of ns.cloud.getServerNames()) {
      if (ns.getServerMaxRam(hostname) >= nextRam) {
        continue;
      }
      const cost = ns.cloud.getServerUpgradeCost(hostname, nextRam);
      if (cost > player.money) {
        updateStatus(
          'Cloud RAM',
          `${ns.format.ram(ram)}/${ns.format.ram(max)} ($${ns.format.number(
            cost,
          )})`,
        );
        return;
      }
      ns.cloud.upgradeServer(hostname, nextRam);
      player.money -= cost;
    }
    ram = nextRam;
    nextRam = ram * 2;
  }
  updateStatus('Cloud RAM', `${ns.format.ram(max)} (MAX)`);
}

function rootServers(ns: NS, player: Player, servers: Required<Server>[]) {
  const files = ['grow.ts', 'hack.ts', 'lib/dan.ts', 'share.ts', 'weaken.ts'];
  const hosts: Host[] = [];
  for (const server of servers) {
    if (server.maxRam === 0) {
      continue;
    }
    // This is not a useless check. Purchased servers start with admin access,
    // even though the required number of ports aren't open (and might not be
    // able to for a while).
    if (!server.hasAdminRights) {
      if (server.numOpenPortsRequired >= PORTS.length) {
        throw new Error(
          `"${server.hostname}" requires ${server.numOpenPortsRequired} open ports`,
        );
      }
      if (server.requiredHackingSkill > player.skills.hacking) {
        continue;
      }
      let anyClosed = false;
      for (let i = server.numOpenPortsRequired; i >= 0; --i) {
        const port = PORTS[i];
        if (port.isOpen(server)) {
          continue;
        }
        if (!ns.fileExists(port.file)) {
          anyClosed = true;
          break;
        }
        port.open(ns, server.hostname);
      }
      if (anyClosed) {
        continue;
      }
      server.hasAdminRights = true;
    }
    ns.scp(files, server.hostname);
    hosts.push(Host.fromServer(ns, server));
  }
  return hosts.sort((a, b) => {
    if (a.cpuCores !== b.cpuCores) {
      return a.cpuCores - b.cpuCores;
    } else {
      return a.ramAvailable - b.ramAvailable;
    }
  });
}

function scanServers(ns: NS) {
  const hostnamesToScan = ['home'];
  const hostnamesScanned = new Set<string>();
  const servers: Required<Server>[] = [];
  for (const hostname of hostnamesToScan) {
    hostnamesToScan.push(
      ...ns.scan(hostname).filter(next => !hostnamesScanned.has(next)),
    );
    hostnamesScanned.add(hostname);
    const server = ns.getServer(hostname);
    if (
      server.backdoorInstalled === undefined ||
      server.baseDifficulty === undefined ||
      server.hackDifficulty === undefined ||
      server.minDifficulty === undefined ||
      server.moneyAvailable === undefined ||
      server.moneyMax === undefined ||
      server.numOpenPortsRequired === undefined ||
      server.openPortCount === undefined ||
      server.requiredHackingSkill === undefined ||
      server.serverGrowth === undefined
    ) {
      throw new Error(`${server.hostname} target properties not defined`);
    }
    servers.push({
      backdoorInstalled: server.backdoorInstalled,
      baseDifficulty: server.baseDifficulty,
      hackDifficulty: server.hackDifficulty,
      minDifficulty: server.minDifficulty,
      moneyAvailable: server.moneyAvailable,
      moneyMax: server.moneyMax,
      numOpenPortsRequired: server.numOpenPortsRequired,
      openPortCount: server.openPortCount,
      requiredHackingSkill: server.requiredHackingSkill,
      serverGrowth: server.serverGrowth,
      ...server,
    });
  }
  return servers;
}

function suggestPorts(
  ns: NS,
  player: Player,
  updateStatus: (key: string, value: string) => void,
) {
  let owned = 0;
  // Don't save up for port openers (othewise we wouldn't buy anything for a
  // long time), but if we don't have one and can afford one of them already,
  // consider that money "spent" so we can afford it when we next notice.
  for (const port of PORTS) {
    if (ns.fileExists(port.file)) {
      ++owned;
      continue;
    }
    if (port.cost > player.money) {
      continue;
    }
    ns.tprint(`WARNING Buy ${port.file}`);
    player.money -= port.cost;
  }
  updateStatus('Ports', `${owned}/${PORTS.length}`);
}

export class Script {
  readonly threads: ThreadReservation[] = [];

  constructor(readonly path: string, readonly duration: number) {}

  exec(ns: NS, target: Readonly<Server>, endMs: number, signalOnLast: boolean) {
    const delay = endMs - this.duration;
    for (let i = 0; i < this.threads.length; ++i) {
      const reservation = this.threads[i];
      ns.exec(
        this.path,
        reservation.host.hostname,
        {temporary: true, threads: reservation.threads},
        `--delay=${delay}`,
        `--server=${
          !signalOnLast || i !== this.threads.length - 1 ? -1 : ns.pid
        }`,
        `--target=${target.hostname}`,
      );
    }
  }

  reserveThreadsFromStart(ns: NS, threadsWanted: number, hosts: Host[]) {
    let threadsLeft = threadsWanted;
    for (let i = 0; i < hosts.length && threadsLeft > 0; ++i) {
      threadsLeft -= this.reserveThreadsOnHost(ns, threadsLeft, hosts[i]);
    }
    return threadsWanted - threadsLeft;
  }

  reserveThreadsOnHost(ns: NS, threadsWanted: number, host: Host) {
    const ramPerThread = host.getScriptRam(ns, this.path);
    const threadsAvailable = Math.floor(host.ramAvailable / ramPerThread);
    const threads = Math.min(threadsWanted, threadsAvailable);
    if (threads === 0) {
      return 0;
    }
    host.ramAvailable -= threads * ramPerThread;
    const reservation = {host: host, threads: threads};
    this.threads.push(reservation);
    return threads;
  }
}

type ThreadReservation = {
  readonly host: Readonly<Host>;
  readonly threads: number;
};

async function iteration(ns: NS, flags: dan.Flags, server: dan.SignalServer) {
  const status = new Map<string, string>();
  function updateStatus(key: string, value: string) {
    status.set(key, value);
    const ret: string[] = [];
    status.forEach((value, key) => ret.push(`${key}: ${value}`));
    dan.updateStatus(ns, flags, ret.join('\n'));
  }

  ns.tprint('INFO ---');

  const player = ns.getPlayer();
  suggestPorts(ns, player, updateStatus);
  purchaseServers(ns, player, updateStatus);

  const servers = scanServers(ns);
  const hosts = rootServers(ns, player, servers);
  const target = bestTarget(ns, player, servers);
  const base = planBase(ns, player, hosts, target);
  updateStatus('Target', base.target.hostname);
  updateStatus('Hosts', hosts.length.toString());

  const ramToStart = base.getRamAvailable();
  updateStatus('RAM free', ns.format.ram(ramToStart));

  let plan = planPrep(ns, base);
  if (plan.hacks !== -1) {
    ns.tprint(`INFO ${plan.hacks} hacks per batch`);

    const stopwatchBatch = new dan.Stopwatch();
    let lastSleep = performance.now();
    while (plan.batches < BATCH_LIMIT) {
      if (performance.now() > lastSleep + 20) {
        updateStatus('Awaits', `${plan.awaits} (${stopwatchBatch.format(ns)})`);
        await ns.asleep(0);
        lastSleep = performance.now();
      }
      const maybePlan = planHWGW(ns, plan.hacks, plan);
      // We're probably out of memory
      if (maybePlan === null) {
        break;
      }
      plan = maybePlan;
    }
    updateStatus('Awaits', `${plan.awaits} (${stopwatchBatch.format(ns)})`);
  }
  for (const [key, count] of plan.debugStrings) {
    ns.tprint(`INFO ${key} (${count}x)`);
  }

  const ramAfterPlan = plan.getRamAvailable();
  updateStatus(
    'RAM free',
    `${ns.format.ram(ramAfterPlan)}/${ns.format.ram(ramToStart)}`,
  );

  const stopwatchWait = new dan.Stopwatch();
  if (!flags.dryRun()) {
    await plan.exec(ns, server, updateStatus);
  }
  const timeSleep = stopwatchWait.getElapsed();
  ns.tprint(`INFO Finished, slept ${ns.format.time(timeSleep)}`);

  if (plan.hacks !== -1 && plan.batches > 0) {
    const moneyPerHack = plan.target.moneyMax * plan.multiplierHack;
    const moneyPerPlan = moneyPerHack * plan.hacks * plan.batches;
    const moneyPerSec = (moneyPerPlan * 1000) / timeSleep;
    ns.tprint(`INFO $${ns.format.number(moneyPerSec)}/s`);
  }
}

export async function main(ns: NS) {
  const flags = new dan.Flags(ns);
  ns.tprint(`INFO dry-run: ${Boolean(flags.dryRun())}`);
  let keepGoing = true;

  const server = new dan.SignalServer(ns);
  server.registerHandler(dan.SIGNAL_STOP, () => {
    ns.tprint('INFO Got SIGNAL_STOP; quitting after next iteration');
    keepGoing = false;
  });
  const neverResolves = server.listen();

  while (keepGoing) {
    await Promise.race([iteration(ns, flags, server), neverResolves]);
    if (flags.dryRun()) {
      keepGoing = false;
    }
  }
  dan.updateStatus(ns, flags, 'Stopped');
}
