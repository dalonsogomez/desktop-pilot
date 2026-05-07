import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";

export interface RecorderControllerOptions {
  binaryPath: string;
  sessionDir: string;
  spawnFn?: (path: string, args: string[]) => ChildProcess;
}

export class RecorderController {
  private proc: ChildProcess | null = null;
  private readonly opts: RecorderControllerOptions;

  constructor(opts: RecorderControllerOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    const mp4 = join(this.opts.sessionDir, "session.mp4");
    const tl = join(this.opts.sessionDir, "timeline.json");
    const spawner = this.opts.spawnFn ?? ((p, a) => spawn(p, a, { stdio: ["pipe", "pipe", "pipe"] }));
    this.proc = spawner(this.opts.binaryPath, [mp4, tl]);
  }

  recordAction(index: number, screenshotFilename?: string): void {
    if (!this.proc?.stdin) throw new Error("Recorder not started");
    const line = screenshotFilename
      ? `action ${index} ${screenshotFilename}\n`
      : `action ${index}\n`;
    this.proc.stdin.write(line);
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    this.proc.stdin?.write("stop\n");
    await new Promise<void>((resolve) => {
      this.proc!.on("exit", () => resolve());
      setTimeout(resolve, 5000);  // safety
    });
    this.proc = null;
  }
}
