import { readFileSync } from "node:fs";
import { parse } from "yaml";

export enum AppleScriptDenyReason {
  AppNotAllowed = "app-not-allowed",
  DoShellScript = "do-shell-script",
  DoJavaScript = "do-javascript",
}

export interface AppleScriptCheckResult {
  safe: boolean;
  reason?: AppleScriptDenyReason;
  detail?: string;
}

const HARDCODED_DENY = new Set(["Keychain Access", "1Password", "1Password 7", "Apple Wallet", "Wallet"]);

export class AppleScriptGuard {
  private allowed: Set<string>;

  constructor(allowlistPath: string) {
    const raw = readFileSync(allowlistPath, "utf8");
    const parsed = parse(raw) as { apps?: string[] };
    this.allowed = new Set(parsed.apps ?? []);
  }

  check(script: string): AppleScriptCheckResult {
    if (/\bdo\s+shell\s+script\b/i.test(script)) {
      return { safe: false, reason: AppleScriptDenyReason.DoShellScript };
    }
    if (/\bdo\s+JavaScript\b/i.test(script)) {
      return { safe: false, reason: AppleScriptDenyReason.DoJavaScript };
    }
    const tellRegex = /tell\s+application\s+"([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = tellRegex.exec(script)) !== null) {
      const app = match[1];
      if (HARDCODED_DENY.has(app) || !this.allowed.has(app)) {
        return { safe: false, reason: AppleScriptDenyReason.AppNotAllowed, detail: app };
      }
    }
    return { safe: true };
  }
}
