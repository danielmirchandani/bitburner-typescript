export {};

function main(i?: number) {
  tprint('Starting');

  while (purchaseHacknetNode()) {
    tprint('Buying a node');
  }

  for (i = 0; i < hacknetnodes.length; i++) {
    hacknetnodes[i].upgradeLevel(200);
    while (hacknetnodes[i].upgradeRam()) {}
    while (hacknetnodes[i].upgradeCore()) {}
  }

  tprint(hacknetnodes.length + ' nodes');
}

main();
