export class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlMs) {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }


  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  
  async getOrSet(key, fetcherFn, ttlMs, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.get(key);
      if (cached !== null) {
        return cached;
      }
    }

    const freshValue = await fetcherFn();
    this.set(key, freshValue, ttlMs);
    return freshValue;
  }

  
  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

export const globalCache = new MemoryCache();