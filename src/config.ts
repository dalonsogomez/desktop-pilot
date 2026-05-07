import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";

export interface Config {
  port: number;
  timeBudgetSeconds: number;
  rateLimitPerSecond: number;
  shortcut: string;
  videoRetentionDays: number;
  storageDir: string;
}

const DEFAULTS: Config = {
  port: 9991,
  timeBudgetSeconds: 300,
  rateLimitPerSecond: 3,
  shortcut: "Ctrl+Opt+Cmd+P",
  videoRetentionDays: 30,
  storageDir: `${process.env.HOME}/Library/Application Support/DesktopPilot`,
};

export function loadConfig(path: string): Config {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  const parsed = parse(raw) as Partial<Config>;
  return { ...DEFAULTS, ...parsed };
}
