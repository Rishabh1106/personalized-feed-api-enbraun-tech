import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const redis = new Redis(REDIS_URL);

// helper to compute jittered ttl
export function jitteredTTL(baseSeconds: number) {
  const jitter = (Math.random() * 0.4 - 0.2) * baseSeconds; // +/-20%
  return Math.max(5, Math.floor(baseSeconds + jitter));
}

export async function withCache(key: string, ttlSeconds: number, compute: () => Promise<any>) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `${key}:lock`;
  const lock = await redis.set(lockKey, "1", "PX", 10000, "NX");
  if (lock) {
    try {
      const result = await compute();
      await redis.set(key, JSON.stringify(result), "EX", jitteredTTL(ttlSeconds));
      return result;
    } finally {
      await redis.del(lockKey);
    }
  }

  // if lock not acquired, wait for cache to appear (avoid stampede)
  const maxWait = 2000; // ms
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const val = await redis.get(key);
    if (val) return JSON.parse(val);
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }

  // fallback to computing without setting cache
  return compute();
}
