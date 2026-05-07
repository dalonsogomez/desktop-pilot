import { spawn, ChildProcess } from "node:child_process";

export interface GuiActorOptions {
  binaryPath: string;
  spawnFn?: (path: string, args: string[]) => ChildProcess;
}

export class GuiActorController {
  private proc: ChildProcess | null = null;
  private buffer = "";
  private pending: Array<(line: string) => void> = [];

  constructor(private opts: GuiActorOptions) {}

  start(): void {
    const spawner =
      this.opts.spawnFn ??
      ((p, a) => spawn(p, a, { stdio: ["pipe", "pipe", "pipe"] }));
    this.proc = spawner(this.opts.binaryPath, []);
    this.proc.stdout?.setEncoding("utf8");
    this.proc.stdout?.on("data", (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        const cb = this.pending.shift();
        if (cb) cb(line);
      }
    });
  }

  async send(command: string): Promise<string> {
    if (!this.proc?.stdin) throw new Error("gui-actor not started");
    this.proc.stdin.write(command + "\n");
    return new Promise<string>((resolve) => {
      this.pending.push(resolve);
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    try {
      await this.send("quit");
    } catch {
      // ignore — process may already be gone
    }
    this.proc = null;
  }
}
