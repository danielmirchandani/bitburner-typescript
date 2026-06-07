/**
 * This is some crazy JS. See Bitburner arcade's limits in "netscript.d.ts". For
 * typed and scoped variables, I use optional function parameters. Without
 * parameter default initializers, I overwrite optional parameters with initial
 * values and hope I always remember not to pass values for those parameters.
 */

export {};

function batch(
  target: string,
  hacks: number,
  weakens: number,
  grows: number,
  weakens_grow: number,
  batch_name: string,
  batch_strings?: string[],
  weaken_time?: number,
  hack_delay?: number,
  grow_delay?: number,
) {
  batch_strings = [batch_name];
  weaken_time = getWeakenTime(target);

  if (hacks) {
    batch_strings.push(hacks + ' hacks');
    hack_delay = Math.floor(weaken_time - getHackTime(target));
    if (
      !run('hack.script', hacks, target, hack_delay - 1, batch_name, 'hack')
    ) {
      return false;
    }
  }

  if (weakens) {
    batch_strings.push(weakens + ' weakens');
    if (!run('weaken.script', weakens, target, 0, batch_name, 'weaken')) {
      return false;
    }
  }

  if (grows) {
    batch_strings.push(grows + ' grows');
    grow_delay = Math.floor(weaken_time - getGrowTime(target));
    if (
      !run('grow.script', grows, target, grow_delay + 1, batch_name, 'grow')
    ) {
      return false;
    }

    batch_strings.push(weakens_grow + ' weakens');
    if (
      !run('weaken.script', weakens_grow, target, 2, batch_name, 'weaken-grow')
    ) {
      return false;
    }
  }

  tprint(batch_strings.join(', '));
  return true;
}

/**
 * Search for the smallest number of threads x such that:
 * 1. `(money_start + x) * pow(ratio_growth, x) >= money_max`
 * 2. `log((money_start + x) * pow(ratio_growth, x)) >= log(money_max)`
 * 3. `log(money_start + x) + log(pow(ratio_growth, x)) >= log(money_max)`
 * 4. `log(money_start + x) + log(ratio_growth) * x >= log(money_max)`
 *
 * This uses Newton-Raphson method to find x such that f(x) = 0 where:
 * 1. `f(x) = log(money_start + x) + log(ratio_growth) * x - log(money_max)`
 * 2. `f'(x) = 1 / (money_start + x) + log(ratio_growth)`
 */
function calculateGrows(
  money_start: number,
  log_max: number,
  log_growth: number,
  x?: number,
  diff?: number,
  f_x?: number,
  df_dx?: number,
) {
  x = 1;
  diff = 9999;
  while (diff < -1 || diff > 1) {
    f_x = Math.log(money_start + x) + log_growth * x - log_max;
    df_dx = 1 / (money_start + x) + log_growth;
    diff = f_x / df_dx;
    x -= diff;
  }
  return Math.ceil(x);
}

function main(
  HOST: string,
  SECURITY_GROW: 0.004,
  SECURITY_HACK: 0.002,
  SERVER_RAM_TOTAL: 0,
  SERVER_RAM_USED: 1,
  WEAKENS_SECURITY: 20,
  target?: string,
  hack_level?: number,
  hack_required?: number,
  security_min?: number,
  hacking?: ReturnType<typeof getHackingMultipliers>,
  money_max?: number,
  ram_grow?: number,
  ram_hack?: number,
  ram_weaken?: number,
  ram_host?: number,
  ratio_hack?: number,
  log_growth?: number,
  log_max?: number,
  grows?: number,
  stop_signal?: unknown,
  hacks_limit?: number,
  hacks?: number,
  money_hacks?: number,
  weakens_hack?: number,
  weakens_grow?: number,
  ram_batch?: number,
  money_batches?: number,
  money_batches_best?: number,
  best_hacks?: number,
  best_weakens_hack?: number,
  best_grows?: number,
  best_weakens_grow?: number,
  batch_count?: number,
) {
  if (args.length !== 1) {
    tprint('ERROR: Use: steal.script [target]');
    return false;
  }

  target = args[0];
  if (!hasRootAccess(target)) {
    tprint('ERROR: ' + target + ' requires root access');
    return false;
  }

  hack_level = getHackingLevel();
  hack_required = getServerRequiredHackingLevel(target);
  if (hack_level < hack_required) {
    tprint('ERROR: ' + target + ' requires hack level ' + hack_required);
    return false;
  }

  security_min = getServerMinSecurityLevel(target);
  if (security_min >= 100) {
    tprint('ERROR: ' + target + ' too high min security ' + security_min);
    return false;
  }

  hacking = getHackingMultipliers();
  money_max = getServerMaxMoney(target);
  ram_grow = getScriptRam('grow.script', HOST);
  ram_hack = getScriptRam('hack.script', HOST);
  ram_weaken = getScriptRam('weaken.script', HOST);
  // Leave 32 GB for anything we want to run manually.
  ram_host = Math.max(getServerRam(HOST)[SERVER_RAM_TOTAL] - 32, 0);

  log_growth =
    Math.min(Math.log1p(0.03 / security_min), Math.log1p(0.0035)) *
    (getServerGrowth(target) / 100) *
    hacking.growth;
  log_max = Math.log(money_max);
  ratio_hack =
    (1 - security_min / 100) * // ease
    (1 - (hack_required - 1) / hack_level) * // skill
    hacking.money *
    (1 / 240);

  grows = calculateGrows(getServerMoneyAvailable(target), log_max, log_growth);
  if (
    !batch(
      target,
      0,
      Math.ceil(
        WEAKENS_SECURITY * (getServerSecurityLevel(target) - security_min),
      ),
      grows,
      Math.ceil(WEAKENS_SECURITY * SECURITY_GROW * grows),
      'prep',
    )
  ) {
    tprint('ERROR: Could not start prep');
    tprint('Batches may need more RAM or are already running');
    return false;
  }

  stop_signal = read(1);
  hacks = 0;
  hacks_limit = Math.ceil(1 / ratio_hack);
  money_batches_best = -1;
  best_hacks = 0;
  best_weakens_hack = 0;
  best_grows = 0;
  best_weakens_grow = 0;
  batch_count = 0;
  tprint(hacks_limit + ' hack limit');

  while (stop_signal === 'NULL PORT DATA') {
    // Starting batches after finding the best hack count wastes many many
    // batches worth of time, so interleave searching with starting batches.
    if (hacks < hacks_limit) {
      ++hacks;
      money_hacks = money_max * Math.min(ratio_hack * hacks, 1);
      weakens_hack = Math.ceil(WEAKENS_SECURITY * SECURITY_HACK * hacks);
      grows = calculateGrows(money_max - money_hacks, log_max, log_growth);
      weakens_grow = Math.ceil(WEAKENS_SECURITY * SECURITY_GROW * grows);
      ram_batch =
        ram_hack * hacks +
        ram_weaken * weakens_hack +
        ram_grow * grows +
        ram_weaken * weakens_grow;
      // Ignore RAM used by prep, assuming prep is done by the time the number
      // of batches would fill RAM.
      money_batches = money_hacks * Math.floor(ram_host / ram_batch);
      if (money_batches > money_batches_best) {
        money_batches_best = money_batches;
        best_hacks = hacks;
        best_weakens_hack = weakens_hack;
        best_grows = grows;
        best_weakens_grow = weakens_grow;
      }
    }

    if (
      !batch(
        target,
        best_hacks,
        best_weakens_hack,
        best_grows,
        best_weakens_grow,
        batch_count.toString(),
      )
    ) {
      break;
    }
    ++batch_count;

    stop_signal = read(1);
  }

  // Flush the port if multiple batches sent a signal
  while (stop_signal !== 'NULL PORT DATA') {
    tprint('Stop signal from ' + stop_signal);
    stop_signal = read(1);
  }
  tprint('Done');
  return true;
}

main(getHostname(), 0.004, 0.002, 0, 1, 20);
