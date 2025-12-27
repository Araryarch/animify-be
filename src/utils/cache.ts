// Simple in-memory cache with TTL
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class CacheManager {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

    set<T>(key: string, data: T, ttl?: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now() + (ttl || this.defaultTTL)
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.timestamp) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.timestamp) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    clear(): void {
        this.cache.clear();
    }

    // Clean expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.timestamp) {
                this.cache.delete(key);
            }
        }
    }
}

export const cache = new CacheManager();

// Auto cleanup every 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000);
