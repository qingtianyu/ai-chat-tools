class RateLimiter {
    constructor(maxRequests = 3, timeWindow = 60000) { // Default: 3 requests per minute
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    async waitForCapacity() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = oldestRequest + this.timeWindow - now;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.waitForCapacity();
        }

        this.requests.push(now);
        return true;
    }

    async executeWithRetry(operation, maxRetries = 3, initialDelay = 1000) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await this.waitForCapacity();
                return await operation();
            } catch (error) {
                lastError = error;
                if (error.message.includes('rate limit') || error.message.includes('429')) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error; // Re-throw if it's not a rate limit error
            }
        }
        throw lastError;
    }
}

export default RateLimiter;
