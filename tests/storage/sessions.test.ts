import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionStore } from "@/storage/sessions";

describe("SessionStore", () => {
  let baseDir: string;
  let store: SessionStore;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "dp-sess-"));
    store = new SessionStore(baseDir);
  });

  it("creates a session with a UUID and metadata", async () => {
    const sess = await store.create({ prompt: "hello" });
    expect(sess.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(existsSync(join(baseDir, sess.id))).toBe(true);
    const meta = JSON.parse(readFileSync(join(baseDir, sess.id, "metadata.json"), "utf8"));
    expect(meta.prompt).toBe("hello");
  });

  it("appends to transcript.jsonl", async () => {
    const sess = await store.create({ prompt: "x" });
    await store.appendTranscript(sess.id, { role: "user", content: "hi" });
    await store.appendTranscript(sess.id, { role: "assistant", content: "hello" });
    const lines = readFileSync(join(baseDir, sess.id, "transcript.jsonl"), "utf8")
      .trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ role: "user", content: "hi" });
  });

  it("lists sessions in reverse chronological order", async () => {
    const a = await store.create({ prompt: "first" });
    await new Promise(r => setTimeout(r, 10));
    const b = await store.create({ prompt: "second" });
    const list = await store.list();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it("exists() returns true for a created session", async () => {
    const sess = await store.create({ prompt: "exists check" });
    expect(await store.exists(sess.id)).toBe(true);
  });

  it("exists() returns false for a non-existent id", async () => {
    expect(await store.exists("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});
