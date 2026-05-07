import { loadConfig } from "@/config";
import { buildServer } from "@/server";
import { existsSync } from "node:fs";

async function main(): Promise<void> {
  const home = process.env.HOME;
  if (!home) {
    console.error("FATAL: HOME environment variable not set");
    process.exit(1);
  }

  const configPath = `${home}/.config/desktop-pilot/config.yaml`;
  if (!existsSync(configPath)) {
    console.error(`FATAL: config not found at ${configPath}. Run scripts/bootstrap.sh first.`);
    process.exit(1);
  }

  const cfg = loadConfig(configPath);
  const installDir = process.env.DESKTOP_PILOT_INSTALL_DIR ?? home + "/desktop-pilot";
  const recorderBinary = `${installDir}/bin/screen-recorder`;
  const guiActorBinary = `${installDir}/bin/gui-actor`;
  const applescriptAllowlistPath = `${home}/.config/desktop-pilot/applescript-allowlist.yaml`;

  const app = await buildServer({
    baseDir: cfg.storageDir,
    port: cfg.port,
    recorderBinary,
    guiActorBinary,
    applescriptAllowlistPath,
    maxActionsPerSecond: cfg.rateLimitPerSecond,
    timeBudgetMs: cfg.timeBudgetSeconds * 1000,
    backend: cfg.backend,
    ollamaUrl: cfg.ollamaUrl,
    ollamaModel: cfg.ollamaModel,
    displayWidth: cfg.displayWidth,
    displayHeight: cfg.displayHeight,
  });

  console.log(`desktop-pilot-bridge listening on http://127.0.0.1:${cfg.port}`);

  const shutdown = async (): Promise<void> => {
    console.log("Shutting down...");
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
