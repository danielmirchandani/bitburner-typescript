export function main(ns: NS) {
  const owned = new Set(ns.singularity.getOwnedAugmentations(true));
  type AugmentInfo = {cost: number; faction: FactionName; name: string};
  const purchase = new Map<string, AugmentInfo>();
  for (const faction of ns.getPlayer().factions) {
    const rep = ns.singularity.getFactionRep(faction);
    for (const augment of ns.singularity.getAugmentationsFromFaction(faction)) {
      if (augment !== 'NeuroFlux Governor' && owned.has(augment)) {
        continue;
      }
      if (purchase.has(augment)) {
        continue;
      }
      if (ns.singularity.getAugmentationRepReq(augment) > rep) {
        continue;
      }
      const prereqs = ns.singularity.getAugmentationPrereq(augment);
      if (!prereqs.every(a => owned.has(a))) {
        continue;
      }
      purchase.set(augment, {
        cost: ns.singularity.getAugmentationPrice(augment),
        faction: faction,
        name: augment,
      });
    }
  }
  if (purchase.size < 1) {
    ns.tprint('INFO No more augments to buy');
    return;
  }
  for (const info of Array.from(purchase.values()).sort(
    (a, b) => b.cost - a.cost,
  )) {
    // If NFG is the most expensive augment, buying it will just make it the
    // most expensive next time too, so ignore it until it's the last one left.
    if (info.name === 'NeuroFlux Governor' && purchase.size > 1) {
      continue;
    }
    const logString = `${info.name} from ${
      info.faction
    } for $${ns.format.number(info.cost)}`;
    if (ns.getPlayer().money < info.cost) {
      ns.tprint(`WARNING Can't afford ${logString}`);
      return;
    }
    ns.tprint(`INFO Buying ${logString}`);
    ns.singularity.purchaseAugmentation(info.faction, info.name);
    ns.run(ns.getScriptName());
    return;
  }
}
