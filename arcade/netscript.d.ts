/**
 * Runtime error JS tokens:
 * - ArrowFunctionExpression
 * - ClassDeclaration
 * - DoWhileStatement
 * - FunctionExpression
 * - ObjectExpression
 * - SpreadElement
 * - TemplateLiteral
 *
 * Other runtime errors:
 * - calling references to player-defined functions
 * - update assignment (+=, etc...) on class members
 * - `+` (unary operator)
 * - `const`
 * - `let`
 * - `null`
 * - `undefined`
 * - `var`
 *
 * Bugs:
 *  - function/method parameter default initializers aren't run
 */

declare global {
  /**
   * Arguments passed into a script can be accessed using a special array called
   * 'args'. The arguments can be accessed like a normal array using the []
   * operator. (args[0], args[1], args[2]...)
   *
   * For example, let's say we want to make a generic script
   * 'generic-run.script' and we plan to pass two arguments into that script.
   * The first argument will be the name of another script, and the second
   * argument will be a number. This generic script will run the script
   * specified in the first argument with the amount of threads specified
   * in the second element. The code would look like:
   *
   * `run(args[0], args[1]);`
   *
   * It is also possible to get the number of arguments that was passed into a
   * script using:
   *
   * `args.length`
   *
   * Note that none of the other functions that typically work with arrays, such
   * as remove(), insert(), clear(), etc., will work on the args array.
   */
  const args: Readonly<string>[];

  /**
   * Run BruteSSH.exe on the target server. BruteSSH.exe must exist on your home
   * computer.\
   * Example: `brutessh('foodnstuff');`
   */
  function brutessh(hostname_or_ip: string): void;

  /**
   * Returns a boolean (true or false) indicating whether the specified file
   * exists on a server. The first argument must be a string with the name of
   * the file. A file can either be a script, program, or literature file. A
   * script name is case-sensitive, but a program/literature file is not. For
   * example, fileExists('brutessh.exe') will work fine, even though the actual
   * program is named BruteSSH.exe.
   *
   * The second argument is a string with the hostname or IP of the server on
   * which to search for the program. This second argument is optional. If it is
   * omitted, then the function will search through the current server (the
   * server running the script that calls this function) for the file.
   *
   * Example: `fileExists('foo.script', 'foodnstuff');`
   * Example: `fileExists('ftpcrack.exe');`
   *
   * The first example above will return true if the script named 'foo.script'
   * exists on the 'foodnstuff' server, and false otherwise. The second example
   * above will return true if the current server (the server on which this
   * function runs) contains the FTPCrack.exe program, and false otherwise.
   */
  function fileExists(filename: string, hostname_or_ip?: string): boolean;

  /**
   * Run FTPCrack.exe on the target server. FTPCrack.exe must exist on your home
   * computer. \
   * Example: `ftpcrack('foodnstuff');`
   */
  function ftpcrack(hostname_or_ip: string): void;

  /**
   * Returns the amount of time in seconds it takes to execute the grow()
   * Netscript function on the server specified by the hostname/ip. The argument
   * must be a string with the hostname/ip of the target server.
   */
  function getGrowTime(hostname_or_ip: string): number;

  /**
   * Returns the Player's current hacking level.
   */
  function getHackingLevel(): number;

  /**
   * Returns an object containing the Player's hacking related multipliers.
   * These multipliers are returned in integer forms, not percentages (e.g. 1.5
   * instead of 150%).
   */
  function getHackingMultipliers(): {
    chance: number;
    speed: number;
    money: number;
    growth: number;
  };

  /**
   * Returns the amount of time in seconds it takes to execute the hack()
   * Netscript function on the server specified by the hostname/ip. The argument
   * must be a string with the hostname/ip of the target server.
   */
  function getHackTime(hostname_or_ip: string): number;

  /**
   * Returns a string with the hostname of the server that the script is running
   * on
   */
  function getHostname(): string;

  /**
   * Returns the cost of purchasing a new Hacknet Node
   */
  function getNextHacknetNodeCost(): number;

  /**
   * Returns the server's intrinsic 'growth parameter'. This growth parameter is
   * a number between 1 and 100 that represents how quickly the server's money
   * grows. This parameter affects the percentage by which this server's money
   * is increased when using the grow() function. A higher growth parameter will
   * result in a higher percentage from grow().
   *
   * The argument passed in must be a string with the hostname or IP of the
   * target server.
   */
  function getServerGrowth(hostname_or_ip: string): number;

  /**
   * Returns the maximum amount of money that can be available on a server. The
   * argument passed in must be a string with the hostname or IP of the target
   * server. \
   * Example: `getServerMaxMoney('foodnstuff');`
   */
  function getServerMaxMoney(hostname_or_ip: string): number;

  /**
   * Returns the minimum security level of a server. The argument passed in must
   * be a string with either the hostname or IP of the target server.
   */
  function getServerMinSecurityLevel(hostname_or_ip: string): number;

  /**
   * Returns the amount of money available on a server. The argument passed in
   * must be a string with either the hostname or IP of the target server. \
   * Example: getServerMoneyAvailable('foodnstuff');
   */
  function getServerMoneyAvailable(hostname_or_ip: string): number;

  /**
   * Returns the number of open ports required to successfully run NUKE.exe on
   * a server. The argument passed in must be a string with either the hostname
   * or IP of the target server.
   */
  function getServerNumPortsRequired(hostname_or_ip: string): number;
  /**
   * Returns the security level of a server. The argument passed in must be a
   * string with either the hostname or IP of the target server. A server's
   * security is denoted by a number, typically between 1 and 100.
   */
  function getServerSecurityLevel(hostname_or_ip: string): number;

  /**
   * Returns the amount of RAM required to run the specified script on the
   * target server. The first argument must be a string with the name of the
   * script. The script name is case sensitive. The second argument is a string
   * with the hostname or IP of the server where that script is. Both arguments
   * are required.
   */
  function getScriptRam(scriptname: string, hostname_or_ip: string): number;

  /**
   * Returns an array with two elements that gives information about the target
   * server's RAM. The first element in the array is the amount of RAM that the
   * server has (in GB). The second element in the array is the amount of RAM
   * that is currently being used on the server.
   */
  function getServerRam(hostname_or_ip: string): [total: number, used: number];

  /**
   * Returns the required hacking level of a server. The argument passed in must
   * be a string with either the hostname or IP or the target server.
   */
  function getServerRequiredHackingLevel(hostname_or_ip: string): number;

  /**
   * Returns the amount of time in seconds it takes to execute the weaken()
   * Netscript function on the server specified by the hostname/ip. The argument
   * must be a string with the hostname/ip of the target server.
   */
  function getWeakenTime(hostname_or_ip: string): number;

  /**
   * Use your hacking skills to increase the amount of money available on a
   * server. The argument passed in must be a string with either the IP or
   * hostname of the target server. The runtime for this command depends on your
   * hacking level and the target server's security level. When grow()
   * completes, the money available on a target server will be increased by a
   * certain, fixed percentage. This percentage is determined by the server's
   * growth rate and varies between servers. Generally, higher-level servers
   * have higher growth rates.
   *
   * Like hack(), grow() can be called on any server, regardless of where the
   * script is running. The grow() command requires root access to the target
   * server, but there is no required hacking level to run the command. It also
   * raises the security level of the target server by 0.004. Returns the number
   * by which the money on the server was multiplied for the growth. Works
   * offline at a slower rate. \
   * Example: `grow('foodnstuff');`
   */
  function grow(hostname_or_ip: string): number;

  /**
   * Core function that is used to try and hack servers to steal money and gain
   * hacking experience. The argument passed in must be a string with either the
   * IP or hostname of the server you want to hack. The runtime for this command
   * depends on your hacking level and the target server's security level. A
   * script can hack a server from anywhere. It does not need to be running on
   * the same server to hack that server. For example, you can create a script
   * that hacks the 'foodnstuff' server and run that script on any server in the
   * game. A successful hack() on a server will raise that server's security
   * level by 0.002. Returns true if the hack is successful and false otherwise.
   *  \
   * Examples: `hack('foodnstuff');` or `hack('148.192.0.12');`
   */
  function hack(hostname_or_ip: string): number;

  /**
   * Netscript provides the following API for accessing and upgrading your
   * Hacknet Nodes through scripts. This API does NOT work offline.
   *
   * Example: The following is an example of one way a script can be used to
   * automate the purchasing and upgrading of Hacknet Nodes. This script
   * purchases new Hacknet Nodes until the player has four. Then, it iteratively
   * upgrades each of those four Hacknet Nodes to a level of at least 75, RAM to
   * at least 8GB, and number of cores to at least 2.
   *
   * ```
   * while(hacknetnodes.length < 4) {
   *     purchaseHacknetNode();
   * }
   * for (i = 0; i < 4; i = i++) {
   *     while (hacknetnodes[i].level <= 75) {
   *         hacknetnodes[i].upgradeLevel(5);
   *         sleep(10000);
   *     }
   * }
   * for (i = 0; i < 4; i = i++) {
   *     while (hacknetnodes[i].ram < 8) {
   *         hacknetnodes[i].upgradeRam();
   *         sleep(10000);
   *     }
   * }
   * for (i = 0; i < 4; i = i++) {
   *     while (hacknetnodes[i].cores < 2) {
   *         hacknetnodes[i].upgradeCore();
   *         sleep(10000);
   *     }
   * }
   * ```
   */
  interface HacknetNode {
    /** Returns the number of cores on the corresponding Hacknet Node */
    readonly cores: number;

    /** Returns the level of the corresponding Hacknet Node */
    readonly level: number;

    /**
     * Returns the income ($ / sec) that the corresponding Hacknet Node earns
     */
    readonly moneyGainRatePerSecond: number;

    /**
     * Returns the total amount of time that the corresponding Hacknet Node has
     * existed
     */
    readonly onlineTimeSeconds: number;

    /** Returns the amount of RAM on the corresponding Hacknet Node */
    readonly ram: number;

    /**
     * Returns the total amount of money that the corresponding Hacknet Node has
     * earned
     */
    readonly totalMoneyGenerated: number;

    /**
     * Attempts to purchase an additional core for the corresponding Hacknet
     * Node. Returns true if the additional core is successfully purchase, and
     * false otherwise.
     */
    upgradeCore(): boolean;

    /**
     * Tries to upgrade the level of the corresponding Hacknet Node n times.
     * The argument n must be a positive integer. Returns true if the Hacknet
     * Node's level is successfully upgraded n times or up to the max level
     * (200), and false otherwise.
     */
    upgradeLevel(n: number | string): boolean;

    /**
     * Tries to upgrade the amount of RAM on the corresponding Hacknet Node.
     * Returns true if the RAM is successfully upgraded, and false otherwise.
     */
    upgradeRam(): boolean;
  }

  /**
   * A special variable. This is an array that maps to the Player's Hacknet
   * Nodes. The Hacknet Nodes are accessed through indexes. These indexes
   * correspond to the number at the end of the name of the Hacknet Node. For
   * example, the first Hacknet Node you purchase will have the same
   * 'hacknet-node-0' and can be accessed with hacknetnodes[0]. The fourth
   * Hacknet Node you purchase will have the name 'hacknet-node-3' and can be
   * accessed with hacknetnodes[3].
   */
  const hacknetnodes: {
    /** Returns the number of Hacknet Nodes that the player owns */
    readonly length: number;
  } & HacknetNode[];

  /**
   * Returns a boolean (true or false) indicating whether or not the Player has
   * root access to a server. The argument passed in must be a string with
   * either the hostname or IP of the target server. \
   * Example:
   * ```
   * if (hasRootAccess('foodnstuff') == false) {
   *     nuke('foodnstuff');
   * }
   * ```
   */
  function hasRootAccess(hostname_or_ip: string): boolean;

  /**
   * Run HTTPWorm.exe on the target server. HTTPWorm.exe must exist on your home
   * computer.\
   * Example: `httpworm('foodnstuff');`
   */
  function httpworm(hostname_or_ip: string): void;

  /**
   * Returns a boolean (true or false) indicating whether the specified script
   * is running on a server. Remember that a script is uniquely identified by
   * both its name and its arguments.
   *
   * The first argument must be a string with the name of the script. The script
   * name is case sensitive. The second argument is a string with the hostname
   * or IP of the target server. Any additional arguments passed to the function
   * will specify the arguments passed into the target script. The function will
   * check whether the script is running on that target server. \
   * Example: `isRunning('foo.script', 'foodnstuff');` \
   * Example: `isRunning('foo.script', getHostname());` \
   * Example: `isRunning('foo.script', 'joesguns', 1, 5, 'test');`
   *
   * The first example above will return true if there is a script named
   * 'foo.script' with no arguments running on the 'foodnstuff' server, and
   * false otherwise. The second example above will return true if there is a
   * script named 'foo.script' with no arguments running on the current server,
   * and false otherwise. The third example above will return true if there is a
   * script named 'foo.script' with the arguments 1, 5, and 'test' running on
   * the 'joesguns' server, and false otherwise.
   */
  function isRunning(
    filename: string,
    hostname_or_ip: string,
    ...args: string[]
  ): boolean;

  /**
   * Run NUKE.exe on the target server. NUKE.exe must exist on your home
   * computer. \
   * Example: `nuke('foodnstuff');`
   */
  function nuke(hostname_or_ip: string): void;

  /**
   * Prints a value or a variable to the scripts logs (which can be viewed with
   * the 'tail [script]' terminal command ).
   */
  function print(x: unknown): void;

  /**
   * Purchases a new Hacknet Node. Returns a number with the index of the
   * Hacknet Node. This index is equivalent to the number at the end of the
   * Hacknet Node's name (e.g The Hacknet Node named 'hacknet-node-4' will have
   * an index of 4). If the player cannot afford to purchase a new Hacknet Node
   * then the function will return false. Does NOT work offline
   */
  function purchaseHacknetNode(): number | false;

  /**
   * Reads data from a port. The first argument must be a number between 1 and
   * 10 that specifies the port. A port is a serialized queue. This function
   * will remove the first element from the queue and return it. If the queue is
   * empty, then the string 'NULL PORT DATA' will be returned.
   */
  function read(port: number): unknown;

  /**
   * Run relaySMTP.exe on the target server. relaySMTP.exe must exist on your
   * home computer. \
   * Example: `relaysmtp('foodnstuff');`
   */
  function relaysmtp(hostname_or_ip: string): void;

  /**
   * Rounds the number n to the nearest integer. If the argument passed in is
   * not a number, then the function will return 0.
   */
  function round(n: number | string): number;

  /**
   * Run a script as a separate process. The first argument that is passed in is
   * the name of the script as a string. This function can only be used to run
   * scripts located on the current server (the server running the script that
   * calls this function). The second argument is optional, and it specifies how
   * many threads to run the script with. This argument must be a number greater
   * than 0. If it is omitted, then the script will be run single-threaded. Any
   * additional arguments will specify arguments to pass into the new script
   * that is being run. If arguments are specified for the new script, then the
   * second argument numThreads argument must be filled in with a value.
   *
   * Returns true if the script is successfully started, and false otherwise.
   * Requires a significant amount of RAM to run this command.
   *
   * The simplest way to use the run command is to call it with just the script
   * name. The following example will run 'foo.script' single-threaded with no
   * arguments:
   *
   * ```
   * run('foo.script');
   * ```
   *
   * The following example will run 'foo.script' but with 5 threads instead of
   * single-threaded:
   *
   * ```
   * run('foo.script', 5);
   * ```
   *
   * The following example will run 'foo.script' single-threaded, and will pass
   * the string 'foodnstuff' into the script as an argument:
   *
   * ```
   * run('foo.script', 1, 'foodnstuff');
   * ```
   */
  function run(
    script: string,
    numThreads?: number | string,
    ...args: unknown[]
  ): boolean;

  /**
   * Returns an array containing the hostnames or IPs of all servers that are
   * one node away from the specified server. The argument must be a string
   * containing the IP or hostname of the target server. The second argument is
   * a boolean that specifies whether the hostnames or IPs of the scanned
   * servers should be output. If it is true then hostnames will be returned,
   * and if false then IP addresses will. This second argument is optional and,
   * if ommitted, the function will output the hostnames of the scanned servers.
   * The hostnames/IPs in the returned array are strings.
   */
  function scan(hostname_or_ip: string, hostnames?: boolean): string[];

  /**
   * Returns a boolean indicating whether any instance of the specified script
   * is running on a server, regardless of its arguments. This is different than
   * the isRunning() function because it does not try to identify a specific
   * instance of a running script by its arguments.
   *
   * The first argument must be a string with the name of the script. The script
   * name is case sensitive. The second argument is a string with the hostname
   * or IP of the target server. Both arguments are required.
   */
  function scriptRunning(scriptname: string, hostname_or_ip: string): boolean;

  /**
   * Suspends the script for n milliseconds. The second argument is an optional
   * boolean that indicates whether or not the function should log the sleep
   * action. If this argument is true, then calling this function will write
   * 'Sleeping for N milliseconds' to the script's logs. If it's false, then
   * this function will not log anything. If this argument is not specified then
   * it will be true by default.
   *
   * Example: `sleep(5000);`
   */
  function sleep(n: number | string, log?: boolean): void;

  /**
   * Run SQLInject.exe on the target server. SQLInject.exe must exist on your
   * home computer. \
   * Example: `sqlinject('foodnstuff');`
   */
  function sqlinject(hostname_or_ip: string): void;

  /**
   * Prints a value or a variable to the Terminal
   */
  function tprint(x: unknown): void;

  /**
   * Use your hacking skills to attack a server's security, lowering the
   * server's security level. The argument passed in must be a string with
   * either the IP or hostname of the target server. The runtime for this
   * command depends on your hacking level and the target server's security
   * level. This function lowers the security level of the target server by
   * 0.05.
   *
   * Like hack() and grow(), weaken() can be called on any server, regardless
   * of where the script is running. This command requires root access to the
   * target server, but there is no required hacking level to run the command.
   * Returns 0.1. Works offline at a slower rate \
   * Example: `weaken('foodnstuff');`
   */
  function weaken(hostname_or_ip: string): 0.1;

  /**
   * Writes data to a port. The first argument must be a number between 1 and 10
   * that specifies the port. The second argument defines the data to write to
   * the port. If the second argument is not specified then it will write an
   * empty string to the port.
   */
  function write(port: number, data?: unknown): void;
}

export {};
