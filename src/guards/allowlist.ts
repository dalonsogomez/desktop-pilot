import { readFileSync } from "node:fs";
import { parse } from "yaml";

const HARDCODED_DENYLIST = new Set([
  "Keychain Access",
  "1Password",
  "1Password 7",
  "Apple Wallet",
  "Wallet",
]);

export class AllowlistGuard {
  private allowed: Set<string>;

  constructor(allowlistPath: string) {
    const raw = readFileSync(allowlistPath, "utf8");
    const parsed = parse(raw) as { apps?: string[] };
    this.allowed = new Set(parsed.apps ?? []);
  }

  isAllowed(appName: string): boolean {
    if (HARDCODED_DENYLIST.has(appName)) return false;
    return this.allowed.has(appName);
  }
}
