import { mkdir, writeFile, appendFile, readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { v4 as uuid } from "uuid";

export interface SessionMetadata {
  id: string;
  prompt: string;
  createdAt: string;
}

export class SessionStore {
  constructor(private baseDir: string) {}

  async create(input: { prompt: string }): Promise<SessionMetadata> {
    const id = uuid();
    const dir = join(this.baseDir, id);
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, "screenshots"), { recursive: true });
    const meta: SessionMetadata = {
      id,
      prompt: input.prompt,
      createdAt: new Date().toISOString(),
    };
    await writeFile(join(dir, "metadata.json"), JSON.stringify(meta, null, 2));
    await writeFile(join(dir, "transcript.jsonl"), "");
    return meta;
  }

  async appendTranscript(id: string, entry: unknown): Promise<void> {
    await appendFile(join(this.baseDir, id, "transcript.jsonl"), JSON.stringify(entry) + "\n");
  }

  async list(): Promise<SessionMetadata[]> {
    const ids = await readdir(this.baseDir);
    const metas: SessionMetadata[] = [];
    for (const id of ids) {
      try {
        const raw = await readFile(join(this.baseDir, id, "metadata.json"), "utf8");
        metas.push(JSON.parse(raw));
      } catch { /* skip non-session dirs */ }
    }
    return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  sessionDir(id: string): string {
    return join(this.baseDir, id);
  }

  async exists(id: string): Promise<boolean> {
    try {
      await access(join(this.baseDir, id, "metadata.json"));
      return true;
    } catch {
      return false;
    }
  }
}
