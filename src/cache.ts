import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const redis = new Redis(REDIS_URL);

/**
 * Compute a TTL with ±20% jitter to prevent cache stampedes.
 */
export function jitteredTTL(baseSeconds: number): number {
  const jitter = (Math.random() * 0.4 - 0.2) * baseSeconds; // ±20%
  const ttl = Math.floor(baseSeconds + jitter);
  return Math.max(5, ttl); // Ensure minimum TTL of 5s
}

/**
 * Cached execution helper.
 * Tries Redis cache first; if missing, acquires a short lock to compute the value
 * and populate cache to prevent "thundering herd" problems.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const lockKey = `${key}:lock`;

  try {
    // ---- Input validation ----
    if (!key || typeof key !== "string") {
      console.warn(`[Cache] Invalid key`, { key });
      return compute();
    }

    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      console.warn(`[Cache] Invalid TTL, skipping cache`, { ttlSeconds });
      return compute();
    }

    // ---- Try reading from cache ----
    const cachedValue = await redis.get(key);
    if (cachedValue) {
      try {
        const parsed = JSON.parse(cachedValue);
        console.log(`[Cache] Hit`, { key });
        return parsed;
      } catch (e: any) {
        console.warn(`[Cache] JSON parse error, ignoring cached value`, {
          key,
          error: e.message,
        });
        await redis.del(key); // remove corrupt data
      }
    }

    console.log(`[Cache] Miss`, { key });

    // ---- Try acquiring lock ----
    const lockAcquired = await redis.set(lockKey, "1", "PX", 10000, "NX");

    if (lockAcquired) {
      console.log(`[Cache] Lock acquired, computing value`, { key });
      try {
        const result = await compute();
        const ttl = jitteredTTL(ttlSeconds);
        await redis.set(key, JSON.stringify(result), "EX", ttl);
        console.log(`[Cache] Stored computed value`, { key, ttl });
        return result;
      } catch (err: any) {
        console.error(`[Cache] Compute failed`, { key, error: err.message });
        throw err;
      } finally {
        await redis.del(lockKey);
        console.log(`[Cache] Lock released`, { key });
      }
    }

    // ---- Lock not acquired: wait for cache to appear (avoid stampede) ----
    console.log(`[Cache] Lock held by another process, waiting...`, { key });
    const maxWait = 2000; // ms
    const startWait = Date.now();

    while (Date.now() - startWait < maxWait) {
      const val = await redis.get(key);
      if (val) {
        try {
          const parsed = JSON.parse(val);
          console.log(`[Cache] Received value after wait`, { key });
          return parsed;
        } catch {
          console.warn(`[Cache] JSON parse failed after wait`, { key });
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    }

    // ---- Still missing after waiting ----
    console.warn(`[Cache] Value not found after wait, computing directly`, { key });
    return compute();
  } catch (err: any) {
    console.error(`[Cache] Unexpected error`, { key, error: err.message });
    return compute(); // Fail open — fallback to computing
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[Cache] Operation completed`, { key, duration: `${duration}ms` });
  }
}
