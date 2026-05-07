export enum ShellDenyReason {
  RmRoot = "rm-root",
  RmHome = "rm-home",
  Sudo = "sudo",
  DiskWrite = "disk-write",
  Mkfs = "mkfs",
  ForkBomb = "fork-bomb",
  ChmodRoot = "chmod-root",
  SystemPath = "system-path",
}

export interface ShellCheckResult {
  safe: boolean;
  reason?: ShellDenyReason;
}

const PATTERNS: { regex: RegExp; reason: ShellDenyReason }[] = [
  { regex: /\brm\s+(-[rRf]+\s+)+(\/(\s|$|\*)|\/\s*\*)/, reason: ShellDenyReason.RmRoot },
  { regex: /\brm\s+(-[rRf]+\s+)+(~|\$HOME)/, reason: ShellDenyReason.RmHome },
  { regex: /\bsudo\b/, reason: ShellDenyReason.Sudo },
  { regex: /\bdd\s+.*\bof=\/dev\/(sd|nvme|disk)/, reason: ShellDenyReason.DiskWrite },
  { regex: />\s*\/dev\/(sd|nvme|disk)/, reason: ShellDenyReason.DiskWrite },
  { regex: /\bmkfs[\.\w]*\b/, reason: ShellDenyReason.Mkfs },
  { regex: /:\(\)\s*\{\s*:\s*\|:\s*&\s*\}\s*;\s*:/, reason: ShellDenyReason.ForkBomb },
  { regex: /\bchmod\s+-R\s+\d+\s+\//, reason: ShellDenyReason.ChmodRoot },
  { regex: /\b(rm|cp|mv|chmod|chown)\s+.*\s+\/(System|usr|Library|bin|sbin|etc)(\/|\s|$)/, reason: ShellDenyReason.SystemPath },
];

export function isShellCommandSafe(cmd: string): ShellCheckResult {
  for (const { regex, reason } of PATTERNS) {
    if (regex.test(cmd)) return { safe: false, reason };
  }
  return { safe: true };
}
