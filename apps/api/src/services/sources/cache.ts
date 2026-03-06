interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  try {
    const value = await loader();
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  } catch (error) {
    if (existing) {
      return existing.value;
    }
    throw error;
  }
}
