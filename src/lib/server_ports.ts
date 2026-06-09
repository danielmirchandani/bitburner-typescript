export const PORTS: Port[] = [
  {
    cost: 0,
    file: 'NUKE.exe',
    isOpen: (server: Server) => server.hasAdminRights,
    open: (ns: NS, hostname: string) => ns.nuke(hostname),
  },
  {
    cost: 500_000,
    file: 'BruteSSH.exe',
    isOpen: (server: Server) => server.sshPortOpen,
    open: (ns: NS, hostname: string) => ns.brutessh(hostname),
  },
  {
    cost: 1_500_000,
    file: 'FTPCrack.exe',
    isOpen: (server: Server) => server.ftpPortOpen,
    open: (ns: NS, hostname: string) => ns.ftpcrack(hostname),
  },
  {
    cost: 5_000_000,
    file: 'relaySMTP.exe',
    isOpen: (server: Server) => server.smtpPortOpen,
    open: (ns: NS, hostname: string) => ns.relaysmtp(hostname),
  },
  {
    cost: 30_000_000,
    file: 'HTTPWorm.exe',
    isOpen: (server: Server) => server.httpPortOpen,
    open: (ns: NS, hostname: string) => ns.httpworm(hostname),
  },
  {
    cost: 250_000_000,
    file: 'SQLInject.exe',
    isOpen: (server: Server) => server.sqlPortOpen,
    open: (ns: NS, hostname: string) => ns.sqlinject(hostname),
  },
];

export type Port = {
  readonly cost: number;
  readonly file: string;
  readonly isOpen: (server: Server) => boolean;
  readonly open: (ns: NS, hostname: string) => boolean;
};
