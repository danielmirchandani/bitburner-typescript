export {};

function main(
  LEVEL: number,
  OPENERS: readonly [file: string, func: (hostname_or_ip: string) => void][],
  scanned?: string[],
  scanQueue?: string[],
  nextLevel?: number,
  nextOpener?: number,
  target?: string,
  neighbors?: string[],
  i?: number,
  requiredLevel?: number,
  ports?: number,
) {
  scanned = [];
  scanQueue = ['home'];
  nextLevel = 9999;
  nextOpener = 9999;
  while (true) {
    target = scanQueue.shift();
    if (!target) {
      break;
    }
    neighbors = scan(target);
    for (i = 0; i < neighbors.length; ++i) {
      if (scanned.indexOf(neighbors[i]) === -1) {
        scanQueue.push(neighbors[i]);
      }
    }
    scanned.push(target);
    if (hasRootAccess(target)) {
      continue;
    }
    requiredLevel = getServerRequiredHackingLevel(target);
    if (LEVEL < requiredLevel) {
      nextLevel = Math.min(nextLevel, requiredLevel);
      continue;
    }
    ports = getServerNumPortsRequired(target);
    if (ports >= OPENERS.length) {
      tprint('Missing opener info for port ' + ports);
      continue;
    }
    for (i = ports; i >= 0; --i) {
      if (!fileExists(OPENERS[i][0])) {
        nextOpener = Math.min(nextOpener, i);
        break;
      }
      OPENERS[i][1](target);
    }
  }
  tprint(scanned.length + ' servers found');
  tprint(nextLevel + ' hack level required next');
  if (nextOpener < OPENERS.length) {
    tprint(OPENERS[nextOpener][0] + ' required');
  }
}

main(getHackingLevel(), [
  ['NUKE.exe', nuke],
  ['BruteSSH.exe', brutessh],
  ['FTPCrack.exe', ftpcrack],
  ['relaySMTP.exe', relaysmtp],
  ['HTTPWorm.exe', httpworm],
  ['SQLInject.exe', sqlinject],
]);
