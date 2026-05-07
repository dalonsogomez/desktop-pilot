import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { GuiActorController } from "@/recorder/gui-actor-controller";

/** Build a fake ChildProcess that echoes each stdin line as "OK <line>" */
function makeFakeProc() {
  const stdout = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
  stdout.setEncoding = vi.fn();

  // write function echoes back "OK <line>" on stdout asynchronously
  const writeFn = vi.fn((data: string) => {
    const line = data.replace(/\n$/, "");
    setImmediate(() => {
      stdout.emit("data", `OK ${line}\n`);
    });
  });

  const proc: any = { stdin: { write: writeFn }, stdout, stderr: new EventEmitter() };
  return proc;
}

describe("GuiActorController", () => {
  it("start() spawns the binary and send() returns the response line", async () => {
    const fakeProc = makeFakeProc();
    const spawnFn = vi.fn().mockReturnValue(fakeProc);

    const ctrl = new GuiActorController({
      binaryPath: "/fake/gui-actor",
      spawnFn,
    });

    ctrl.start();
    expect(spawnFn).toHaveBeenCalledWith("/fake/gui-actor", []);

    const response = await ctrl.send("click left 100 200");
    expect(response).toBe("OK click left 100 200");
  });

  it("send() resolves responses in order (FIFO)", async () => {
    const fakeProc = makeFakeProc();

    const ctrl = new GuiActorController({
      binaryPath: "/fake/gui-actor",
      spawnFn: () => fakeProc,
    });

    ctrl.start();

    const [r1, r2] = await Promise.all([
      ctrl.send("move 10 20"),
      ctrl.send("cursor"),
    ]);

    expect(r1).toBe("OK move 10 20");
    expect(r2).toBe("OK cursor");
  });

  it("stop() sends quit and clears the process reference", async () => {
    const fakeProc = makeFakeProc();

    const ctrl = new GuiActorController({
      binaryPath: "/fake/gui-actor",
      spawnFn: () => fakeProc,
    });

    ctrl.start();
    await ctrl.stop();

    // After stop(), send() should throw because proc is null
    await expect(ctrl.send("click left 0 0")).rejects.toThrow("gui-actor not started");
  });
});
