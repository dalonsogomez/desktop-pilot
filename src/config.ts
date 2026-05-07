import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";

export interface Config {
  port: number;
  timeBudgetSeconds: number;
  rateLimitPerSecond: number;
  shortcut: string;
  videoRetentionDays: number;
  storageDir: string;
  backend: "anthropic" | "ui-tars";
  ollamaUrl: string;
  ollamaModel: string;
  displayWidth: number;
  displayHeight: number;
}

function defaultStorageDir(): string {
  const home = process.env.HOME;
  if (!home) {
    throw new Error("HOME environment variable is not set; cannot compute default storageDir");
  }
  return `${home}/Library/Application Support/DesktopPilot`;
}

const DEFAULTS: Config = {
  port: 9991,
  timeBudgetSeconds: 300,
  rateLimitPerSecond: 3,
  shortcut: "Ctrl+Opt+Cmd+P",
  videoRetentionDays: 30,
  storageDir: defaultStorageDir(),
  backend: "anthropic",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "0000/ui-tars-1.5-7b",
  displayWidth: 1920,
  displayHeight: 1080,
};

export function loadConfig(path: string): Config {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  const parsed = parse(raw) as Partial<Config>;
  return { ...DEFAULTS, ...parsed };
}
