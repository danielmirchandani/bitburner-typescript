export {};

function main(port?: number) {
  if (args.length < 2) {
    tprint('ERROR: Use write.script [port] [data]');
    return false;
  }

  port = round(args[0]);
  if (port < 1 || port > 10) {
    tprint('ERROR: port must be between 1 and 10');
    return false;
  }

  write(port, args[1]);
  return true;
}

main();
