import {PORTS} from '../lib/server_ports.ts';

function openPorts(ns: NS, server: Server, hackLimit: number) {
  if (server.numOpenPortsRequired === undefined) {
    throw new Error(`${server.hostname} doesn't define numOpenPortsRequired`);
  }
  if (server.numOpenPortsRequired >= PORTS.length) {
    throw new Error(
      `"${server.hostname}" requires ${server.numOpenPortsRequired} open ports`,
    );
  }
  if (server.requiredHackingSkill === undefined) {
    throw new Error(`${server.hostname} doesn't define requiredHackingSkill`);
  }
  if (server.requiredHackingSkill > hackLimit) {
    return;
  }
  let allOpen = true;
  for (let i = server.numOpenPortsRequired; i >= 0; --i) {
    const port = PORTS[i];
    if (port.isOpen(server)) {
      continue;
    }
    if (!ns.fileExists(port.file)) {
      allOpen = false;
      break;
    }
    port.open(ns, server.hostname);
  }
  if (allOpen) {
    server.hasAdminRights = true;
  }
}

type Scan = {
  readonly hostname: string;
  readonly connections: string[];
};

export async function main(ns: NS) {
  const player = ns.getPlayer();
  const scans: Scan[] = [{hostname: 'home', connections: ns.scan('home')}];
  const scanned = new Set<string>(['home']);
  while (scans.length > 0) {
    const scan = scans[scans.length - 1];
    const nextHostname = scan.connections.pop();
    if (nextHostname === undefined) {
      scans.pop();
      if (scans.length > 0) {
        ns.singularity.connect(scans[scans.length - 1].hostname);
      }
      continue;
    }
    const server = ns.getServer(nextHostname);
    if (server.purchasedByPlayer) {
      continue;
    }
    if (!server.hasAdminRights && 'numOpenPortsRequired' in server) {
      openPorts(ns, server, player.skills.hacking);
    }
    if (!server.backdoorInstalled && server.hasAdminRights) {
      ns.tprint(`INFO ${nextHostname} installing backdoor`);
      if (!ns.singularity.connect(nextHostname)) {
        throw new Error(
          `Could not connect to ${nextHostname}; currently at ${scan.hostname}`,
        );
      }
      await ns.singularity.installBackdoor();
      if (!ns.singularity.connect(scan.hostname)) {
        throw new Error(
          `Could not get back to ${scan.hostname} from ${nextHostname}`,
        );
      }
    }
    const nextLevel = ns.scan(nextHostname).filter(h => !scanned.has(h));
    if (nextLevel.length > 0) {
      scans.push({hostname: nextHostname, connections: nextLevel});
      ns.singularity.connect(nextHostname);
    }
    scanned.add(nextHostname);
  }
}
