import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/runner/rate-limit";

describe("RateLimiter", () => {
  it("allows up to N actions per second", async () => {
    const rl = new RateLimiter({ maxPerSecond: 3 });
    const t0 = Date.now();
    await rl.acquire();
    await rl.acquire();
    await rl.acquire();
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it("waits when exceeding the budget", async () => {
    const rl = new RateLimiter({ maxPerSecond: 3 });
    const t0 = Date.now();
    await rl.acquire();
    await rl.acquire();
    await rl.acquire();
    await rl.acquire();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(300);
  });
});
