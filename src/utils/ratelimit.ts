// Simple in-memory rate limiter
interface RateLimitEntry {
    count: number;
    resetTime: number;
}

class RateLimiter {
    private requests: Map<string, RateLimitEntry> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests: number = 100, windowMs: number = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
        const now = Date.now();
        const entry = this.requests.get(identifier);

        // No entry or expired window
        if (!entry || now > entry.resetTime) {
            this.requests.set(identifier, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetTime: now + this.windowMs
            };
        }

        // Within window
        if (entry.count >= this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime
            };
        }

        // Increment count
        entry.count++;
        this.requests.set(identifier, entry);

        return {
            allowed: true,
            remaining: this.maxRequests - entry.count,
            resetTime: entry.resetTime
        };
    }

    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.requests.entries()) {
            if (now > entry.resetTime) {
                this.requests.delete(key);
            }
        }
    }
}

// Different limits for different endpoints
export const globalLimiter = new RateLimiter(100, 60000); // 100 req/min
export const scrapeLimiter = new RateLimiter(30, 60000);  // 30 req/min for scraping endpoints

// Auto cleanup every 5 minutes
setInterval(() => {
    globalLimiter.cleanup();
    scrapeLimiter.cleanup();
}, 5 * 60 * 1000);
