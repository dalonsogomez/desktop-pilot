export interface RateLimiterOptions {
  maxPerSecond: number;
}

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(private opts: RateLimiterOptions) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 1000);
    if (this.timestamps.length >= this.opts.maxPerSecond) {
      const oldest = this.timestamps[0];
      const waitMs = 1000 - (now - oldest);
      await new Promise((r) => setTimeout(r, waitMs));
      return this.acquire();
    }
    this.timestamps.push(Date.now());
  }
}
