import { describe, expect, it, vi, beforeEach } from "vitest";
import { RecorderController } from "@/recorder/controller";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("RecorderController", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "dp-rec-"));
  });

  it("emits an action event that gets sent to the recorder process", async () => {
    const fakeProc: any = {
      stdin: { write: vi.fn() },
      kill: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    };
    const ctrl = new RecorderController({
      binaryPath: "/bin/cat",  // dummy
      sessionDir: dir,
      spawnFn: () => fakeProc,
    });
    await ctrl.start();
    ctrl.recordAction(0, "000-click.png");
    expect(fakeProc.stdin.write).toHaveBeenCalledWith("action 0 000-click.png\n");
  });

  it("stop() sends 'stop' and waits", async () => {
    const fakeProc: any = {
      stdin: { write: vi.fn() },
      kill: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: (event: string, cb: () => void) => { if (event === "exit") setTimeout(cb, 10); },
    };
    const ctrl = new RecorderController({
      binaryPath: "/bin/cat",
      sessionDir: dir,
      spawnFn: () => fakeProc,
    });
    await ctrl.start();
    await ctrl.stop();
    expect(fakeProc.stdin.write).toHaveBeenCalledWith("stop\n");
  });
});
