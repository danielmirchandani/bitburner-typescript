// Netscript `round` costs in-game RAM and Netscript doesn't provide `parseInt`
// or `Number.parseInt`, so take advantage of `sleep` accepting strings.
sleep(args[1] + '000');
grow(args[0]);
