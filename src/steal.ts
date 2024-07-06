import type {NS, Player, Server} from '../NetscriptDefinitions.d.ts';
import * as dan from './lib/dan.js';

type Port = {
  readonly cost: number;
  readonly file: string;
  readonly getOpener: (ns: NS) => (hostname: string) => void;
  readonly isOpen: (server: Server) => boolean;
};

const PORTS: Port[] = [
  {
    cost: 0,
    file: 'NUKE.exe',
    getOpener: (ns: NS) => ns.nuke,
    isOpen: (server: Server) => server.hasAdminRights,
  },
  {
    cost: 500_000,
    file: 'BruteSSH.exe',
    getOpener: (ns: NS) => ns.brutessh,
    isOpen: (server: Server) => server.sshPortOpen,
  },
  {
    cost: 1_500_000,
    file: 'FTPCrack.exe',
    getOpener: (ns: NS) => ns.ftpcrack,
    isOpen: (server: Server) => server.ftpPortOpen,
  },
  {
    cost: 5_000_000,
    file: 'relaySMTP.exe',
    getOpener: (ns: NS) => ns.relaysmtp,
    isOpen: (server: Server) => server.smtpPortOpen,
  },
  {
    cost: 30_000_000,
    file: 'HTTPWorm.exe',
    getOpener: (ns: NS) => ns.httpworm,
    isOpen: (server: Server) => server.httpPortOpen,
  },
  {
    cost: 250_000_000,
    file: 'SQLInject.exe',
    getOpener: (ns: NS) => ns.sqlinject,
    isOpen: (server: Server) => server.sqlPortOpen,
  },
];
const SECURITY_PER_GROW = 0.004;
const SECURITY_PER_HACK = 0.002;
const SECURITY_PER_WEAKEN = 0.05;
const WEAKENS_PER_GROW = SECURITY_PER_GROW / SECURITY_PER_WEAKEN;
const WEAKENS_PER_HACK = SECURITY_PER_HACK / SECURITY_PER_WEAKEN;

function bestTarget(ns: NS, servers: Required<Server>[]) {
  const hasFormulas = ns.fileExists('Formulas.exe');
  const player = ns.getPlayer();

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
    const ramPerGrow = ns.getScriptRam('grow.js', target.hostname);
    const ramPerHack = ns.getScriptRam('hack.js', target.hostname);
    const ramPerWeaken = ns.getScriptRam('weaken.js', target.hostname);

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
        ns.formulas.hacking.weakenTime(scratch, player)
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
      const scratch = ns.getServer(target.hostname);
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
  predicate: (_: number) => boolean
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
    private readonly scriptRamCache: Map<string, number>
  ) {}

  copy() {
    return new Host(
      this.server,
      this.cpuCores,
      this.hostname,
      this.ramAvailable,
      // For the same host, scripts use the same RAM, so sharing the cache
      // is actually a benefit.
      this.scriptRamCache
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
      new Map()
    );
  }

  getScriptRam(ns: NS, script: string) {
    let ram = this.scriptRamCache.get(script);
    if (ram === undefined) {
      ram = ns.getScriptRam(script, this.hostname);
      if (ram === 0) {
        throw new Error(
          `${script} is either missing from ${this.hostname} or doesn't compile`
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
  threads: number
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
      host.cpuCores
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
  private awaits = 0;
  private batches: number = 0;
  readonly debugStrings = new Map<string, number>();
  private scripts: Readonly<Script>[][] = [];

  constructor(
    readonly player: Readonly<Player>,
    private hosts: Readonly<Host>[],
    private target: Readonly<Required<Server>>,
    readonly multiplierHack: number,
    readonly timeGrow: number,
    readonly timeHack: number,
    readonly timeWeaken: number,
    readonly hasFormulas: boolean
  ) {}

  async exec(
    ns: NS,
    server: dan.SignalServer,
    updateStatus: (key: string, value: string) => void
  ) {
    const durationMax = this.scripts.reduce(
      (max, scripts) =>
        Math.max(
          max,
          scripts.reduce((max, current) => Math.max(max, current.duration), 0)
        ),
      0
    );
    const shareScript = 'share.js';

    let keepGoing = true;
    let sharePids: number[] = [];

    const planDone = new Promise<void>(resolve => {
      server.registerHandler(dan.SIGNAL_STEAL_DONE, resolve);
    }).then(() => {
      server.unregisterHandler(dan.SIGNAL_STEAL_DONE);
      keepGoing = false;
    });

    for (let i = 0; i < this.scripts.length; ++i) {
      for (let j = 0; j < this.scripts[i].length; ++j) {
        this.scripts[i][j].exec(
          ns,
          this.target,
          durationMax,
          i === this.scripts.length - 1 && j === this.scripts[i].length - 1
        );
      }
    }

    const stopwatchWait = new dan.Stopwatch(ns);
    while (keepGoing) {
      const duration = durationMax - stopwatchWait.getElapsed();
      updateStatus('Left', ns.tFormat(duration));

      const shareDone = new Promise<void>(resolve => {
        server.registerHandler(dan.SIGNAL_SHARE_DONE, resolve);
      }).then(() => {
        server.unregisterHandler(dan.SIGNAL_SHARE_DONE);
        ns.print(`INFO All share scripts finished: ${stopwatchWait}`);
      });

      sharePids = [];
      for (let i = 0; i < this.hosts.length; ++i) {
        const host = this.hosts[i];
        const ramPerThread = host.getScriptRam(ns, shareScript);
        const threads = Math.floor(host.ramAvailable / ramPerThread);
        if (threads === 0) {
          continue;
        }
        // The outer loop doesn't start in dry-run, so don't check.
        sharePids.push(
          ns.exec(
            shareScript,
            host.hostname,
            {temporary: true, threads: threads},
            `--server=${i !== this.hosts.length - 1 ? -1 : ns.pid}`
          )
        );
      }
      await Promise.race([planDone, shareDone]);
    }
    for (const pid of sharePids) {
      ns.kill(pid);
    }
  }

  getAwaitCount() {
    return this.awaits;
  }

  getBatches() {
    return this.batches;
  }

  getHosts(): Readonly<Readonly<Host>[]> {
    return this.hosts;
  }

  getRamAvailable() {
    return this.hosts.reduce((sum, host) => sum + host.ramAvailable, 0);
  }

  getTarget() {
    return this.target;
  }

  growAmount(
    ns: NS,
    target: Readonly<Required<Server>>,
    grows: number,
    host: Readonly<Host>
  ) {
    if (this.hasFormulas) {
      return ns.formulas.hacking.growAmount(
        target,
        this.player,
        grows,
        host.cpuCores
      );
    } else {
      return Math.min(
        target.moneyAvailable * growPercentSearch(ns, target, host, grows),
        target.moneyMax
      );
    }
  }

  growThreads(
    ns: NS,
    target: Readonly<Required<Server>>,
    host: Readonly<Host>
  ) {
    if (this.hasFormulas) {
      return ns.formulas.hacking.growThreads(
        target,
        this.player,
        target.moneyMax,
        host.cpuCores
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
    const plan = this;
    return {
      batches: 0,
      debugStrings: new Map(),
      hosts: plan.hosts.map(host => host.copy()),
      scripts: [],
      target: {...plan.target},

      addDebugString(key: string) {
        dan.mapIncrement(this.debugStrings, key, 1);
      },

      commit() {
        plan.awaits += this.scripts.reduce(
          (sum, script) => sum + script.threads.length,
          0
        );
        plan.batches += this.batches;
        this.debugStrings.forEach((value, key) => {
          dan.mapIncrement(plan.debugStrings, key, value);
        });
        plan.hosts = this.hosts;
        plan.scripts.push(this.scripts);
        plan.target = this.target;
        return plan;
      },
    };
  }
}

interface PlanTransaction {
  batches: number;
  debugStrings: Map<string, number>;
  hosts: Host[];
  scripts: Script[];
  target: Required<Server>;

  addDebugString(key: string): void;
  commit(): Plan;
}

function planBase(ns: NS, player: Player): Plan {
  const servers = scanServers(ns);
  const hosts = rootServers(ns, player, servers);
  const target = bestTarget(ns, servers);
  return new Plan(
    player,
    hosts,
    target,
    ns.hackAnalyze(target.hostname),
    ns.getGrowTime(target.hostname),
    ns.getHackTime(target.hostname),
    ns.getWeakenTime(target.hostname),
    ns.fileExists('Formulas.exe')
  );
}

function planGrow(ns: NS, grows: number, plan: Plan) {
  const txn = plan.transaction();

  const scriptGrow = Script.newGrow(plan);
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
  txn.scripts.push(scriptGrow);

  const scriptWeaken = Script.newWeaken(plan);
  const weakens = Math.ceil(grows * WEAKENS_PER_GROW);
  if (
    scriptWeaken.reserveThreadsFromStart(ns, weakens, txn.hosts) !== weakens
  ) {
    return null;
  }
  txn.scripts.push(scriptWeaken);

  txn.addDebugString(`${grows} grow, ${weakens} weaken`);
  return txn;
}

export function planHWGW(ns: NS, hacks: number, plan: Plan): Plan | null {
  const txn = plan.transaction();

  const scriptHack = Script.newHack(plan);
  if (scriptHack.reserveThreadsFromStart(ns, hacks, txn.hosts) !== hacks) {
    return null;
  }
  const money = txn.target.moneyMax * plan.multiplierHack * hacks;
  txn.scripts.push(scriptHack);
  txn.target.moneyAvailable -= Math.min(money, txn.target.moneyAvailable);

  const scriptHackWeaken = Script.newWeaken(plan);
  const weakensHackWanted = Math.ceil(WEAKENS_PER_HACK * hacks);
  const weakensHack = scriptHackWeaken.reserveThreadsFromStart(
    ns,
    weakensHackWanted,
    txn.hosts
  );
  if (weakensHack !== weakensHackWanted) {
    return null;
  }
  txn.scripts.push(scriptHackWeaken);

  const scriptGrow = Script.newGrow(plan);
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
  txn.scripts.push(scriptGrow);

  const scriptGrowWeaken = Script.newWeaken(plan);
  const weakensGrowWanted = Math.ceil(WEAKENS_PER_GROW * growsTotal);
  const weakensGrow = scriptGrowWeaken.reserveThreadsFromStart(
    ns,
    weakensGrowWanted,
    txn.hosts
  );
  if (weakensGrow !== weakensGrowWanted) {
    return null;
  }
  txn.scripts.push(scriptGrowWeaken);

  txn.batches += 1;
  txn.addDebugString(
    `${hacks} hack, ${weakensHack} weaken, ${growsTotal} grow, ${weakensGrow} weaken`
  );
  return txn.commit();
}

/**
 * Figure out the "ideal" number of hacks per HWGW batch.
 *
 * In reality, batches don't use the same RAM because, even for the same number
 * of hacks, grows increase as the hosts they're split between increase. The
 * slight loss in efficiency per batch (~10%) is more than made up for by
 * planning _far_ more batches (10x for me) in the same amount of planning time.
 */
function planHacksPerBatch(ns: NS, plan: Plan) {
  // Any threads beyond this will have no money to steal, so efficiency only
  // goes down after this.
  const limit = Math.floor(1 / plan.multiplierHack);
  if (limit > 1_000_000) {
    return -1;
  }
  const ramToStart = plan.getRamAvailable();
  const hosts = plan.getHosts();
  const bestHost = hosts[hosts.length - 1];
  const worstHost = hosts[0];

  let bestEfficiency = 0;
  let bestHacks = -1;
  for (let i = 1; i <= limit; ++i) {
    const weakensHack = Math.ceil(WEAKENS_PER_HACK * i);
    const grows = plan.growThreads(ns, plan.getTarget(), worstHost);
    const weakensGrow = Math.ceil(WEAKENS_PER_GROW * grows);
    const ramLowerBound =
      i * bestHost.getScriptRam(ns, 'hack.js') +
      weakensHack * bestHost.getScriptRam(ns, 'weaken.js') +
      grows * worstHost.getScriptRam(ns, 'grow.js') +
      weakensGrow * bestHost.getScriptRam(ns, 'weaken.js');

    // Scripts don't pack 100% effectively, so arbitrarily say 50% of total
    // host RAM is the threshold for too-big batches.
    if (ramLowerBound > ramToStart / 2) {
      continue;
    }

    // All plans have the same wait, so we don't need to consider it.
    const moneyPossible = plan.multiplierHack * i;
    const money = Math.min(moneyPossible, plan.getTarget().moneyAvailable);
    const efficiency = money / ramLowerBound;
    if (efficiency <= bestEfficiency) {
      continue;
    }
    bestEfficiency = efficiency;
    bestHacks = i;
  }
  return bestHacks;
}

export function planPrep(ns: NS, plan: Plan): Plan {
  const txn = plan.transaction();

  const securityWeakenInitial =
    txn.target.hackDifficulty - txn.target.minDifficulty;
  if (securityWeakenInitial > 0) {
    const scriptWeaken = Script.newWeaken(plan);
    const weakensWanted = Math.ceil(
      securityWeakenInitial / SECURITY_PER_WEAKEN
    );
    // Take all the weakens we can get, but bail early if we couldn't get
    // all of them so the next iteration can keep prepping.
    const weakens = scriptWeaken.reserveThreadsFromStart(
      ns,
      weakensWanted,
      txn.hosts
    );
    txn.scripts.push(scriptWeaken);
    txn.target.hackDifficulty -= SECURITY_PER_WEAKEN * weakens;

    txn.addDebugString(`${weakens} weaken`);
    if (weakens !== weakensWanted) {
      return txn.commit();
    }
  }

  // `growthAnalyze` error is too large for us for multipliers this large.
  if (!plan.hasFormulas && txn.target.moneyAvailable <= 1) {
    ns.tprint(
      `ERROR "${txn.target.hostname}" < $1; if this repeats, stop the script.`
    );

    const scriptGrow = Script.newGrow(plan);
    const grows = scriptGrow.reserveThreadsOnHost(
      ns,
      Number.POSITIVE_INFINITY,
      txn.hosts[txn.hosts.length - 1]
    );
    txn.scripts.push(scriptGrow);

    const scriptWeaken = Script.newWeaken(plan);
    const weakens = scriptWeaken.reserveThreadsFromStart(
      ns,
      Math.ceil(grows * WEAKENS_PER_GROW),
      txn.hosts
    );
    txn.scripts.push(scriptWeaken);

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

function purchaseServers(ns: NS, player: Player) {
  const limit = ns.getPurchasedServerLimit();
  let ram = 2;
  for (let i = ns.getPurchasedServers().length; i < limit; ++i) {
    const cost = ns.getPurchasedServerCost(ram);
    if (cost > player.money) {
      ns.tprint(
        `INFO Purchased server ${i} with ${ns.formatRam(ram)} RAM costs $${ns.formatNumber(cost)}`
      );
      return;
    }
    ns.purchaseServer('home', ram);
    player.money -= cost;
  }
  const max = ns.getPurchasedServerMaxRam();
  let nextRam = ram * 2;
  while (nextRam <= max) {
    for (const hostname of ns.getPurchasedServers()) {
      if (ns.getServerMaxRam(hostname) >= nextRam) {
        continue;
      }
      const cost = ns.getPurchasedServerUpgradeCost(hostname, nextRam);
      if (cost > player.money) {
        ns.tprint(
          `INFO Purchased server ${ns.formatRam(nextRam)} upgrade costs $${ns.formatNumber(cost)}`
        );
        return;
      }
      ns.upgradePurchasedServer(hostname, nextRam);
      player.money -= cost;
    }
    ram = nextRam;
    nextRam = ram * 2;
  }
  ns.tprint(
    `INFO ${limit} purchased servers with at least ${ns.formatRam(ram)} RAM`
  );
}

function rootServers(ns: NS, player: Player, servers: Required<Server>[]) {
  const files = ['grow.js', 'hack.js', 'lib/dan.js', 'share.js', 'weaken.js'];
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
          `"${server.hostname}" requires ${server.numOpenPortsRequired} open ports`
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
        port.getOpener(ns)(server.hostname);
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
      ...ns.scan(hostname).filter(next => !hostnamesScanned.has(next))
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

function suggestPorts(ns: NS, player: Player) {
  // Don't save up for port openers (othewise we wouldn't buy anything for a
  // long time), but if we don't have one and can afford one of them already,
  // consider that money "spent" so we can afford it when we next notice.
  for (const port of PORTS) {
    if (ns.fileExists(port.file)) {
      continue;
    }
    if (port.cost > player.money) {
      continue;
    }
    ns.tprint(`WARNING Buy ${port.file}`);
    player.money -= port.cost;
  }
}

export class Script {
  readonly threads: ThreadReservation[] = [];

  private constructor(
    readonly path: string,
    readonly duration: number
  ) {}

  exec(ns: NS, target: Readonly<Server>, endMs: number, signalOnLast: boolean) {
    const delay = endMs - this.duration;
    for (let i = 0; i < this.threads.length; ++i) {
      const reservation = this.threads[i];
      ns.exec(
        this.path,
        reservation.host.hostname,
        {temporary: true, threads: reservation.threads},
        `--delay=${delay}`,
        `--server=${!signalOnLast || i !== this.threads.length - 1 ? -1 : ns.pid}`,
        `--target=${target.hostname}`
      );
    }
  }

  static newGrow(plan: Plan) {
    return new Script('grow.js', plan.timeGrow);
  }

  static newHack(plan: Plan) {
    return new Script('hack.js', plan.timeHack);
  }

  static newWeaken(plan: Plan) {
    return new Script('weaken.js', plan.timeWeaken);
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
  const base = planBase(ns, player);
  updateStatus('Target', base.getTarget().hostname);
  updateStatus('Hosts', base.getHosts().length.toString());

  const ramToStart = base.getRamAvailable();
  updateStatus('RAM free', ns.formatRam(ramToStart));

  let plan = planPrep(ns, base);
  const hacksPerBatch = planHacksPerBatch(ns, plan);
  if (hacksPerBatch === -1) {
    ns.tprint('WARNING Could not plan number of hacks per batch');
  } else {
    ns.tprint(`INFO ${hacksPerBatch} hacks per batch`);

    const stopwatchBatch = new dan.Stopwatch(ns);
    let lastSleep = performance.now();
    while (plan.getAwaitCount() < 1_000_000) {
      if (performance.now() > lastSleep + 20) {
        updateStatus('Awaits', `${plan.getAwaitCount()} (${stopwatchBatch})`);
        await ns.sleep(0);
        lastSleep = performance.now();
      }
      const maybePlan = planHWGW(ns, hacksPerBatch, plan);
      // We're probably out of memory
      if (maybePlan === null) {
        break;
      }
      plan = maybePlan;
    }
    updateStatus('Awaits', `${plan.getAwaitCount()} (${stopwatchBatch})`);
  }
  for (const [key, count] of plan.debugStrings) {
    ns.tprint(`INFO ${key} (${count}x)`);
  }

  const ramAfterPlan = plan.getRamAvailable();
  updateStatus(
    'RAM free',
    `${ns.formatRam(ramAfterPlan)}/${ns.formatRam(ramToStart)}`
  );

  const stopwatchWait = new dan.Stopwatch(ns);
  if (!flags.dryRun()) {
    await plan.exec(ns, server, updateStatus);
  }
  const timeSleep = stopwatchWait.getElapsed();
  ns.tprint(`INFO Finished, slept ${ns.tFormat(stopwatchWait.getElapsed())}`);

  if (hacksPerBatch > 0 && plan.batches > 0) {
    const moneyPerSec =
      (plan.multiplierHack *
        hacksPerBatch *
        plan.batches *
        plan.target.moneyMax *
        1000) /
      timeSleep;
    ns.tprint(`INFO $${dan.formatInt(ns, moneyPerSec)}/s`);
  }

  if (ramAfterPlan < ramToStart / 2) {
    suggestPorts(ns, player);
    purchaseServers(ns, player);
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
  ns.tprint('INFO Done!');
}
