const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const env = require('../config/env');
const cache = require('../services/cache/cache.service');

// Builds an express-rate-limit middleware. With RATE_LIMIT_STORE=redis the
// hit counts live in Redis, so every API process behind the load balancer
// shares one counter — in-memory counters multiply with the number of
// processes (4 processes turn a 3-per-minute OTP limit into 12).
//
// `name` keeps each limiter's counters apart in Redis; it must be unique.
// If Redis is unreachable the request is let through (passOnStoreError)
// rather than failing every API call.
function createRateLimiter(name, options) {
  const config = {
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  };

  if (env.RATE_LIMIT.store === 'redis') {
    const store = new RedisStore({
      prefix: `rl:${name}:`,
      sendCommand: (...args) => cache.getClient().call(...args),
    });
    // The store preloads its Lua scripts at construction, before Redis has
    // necessarily connected; it reloads them on first use, so a failed
    // preload is harmless — mark it handled instead of an unhandled rejection.
    store.incrementScriptSha.catch(() => {});
    store.getScriptSha.catch(() => {});

    config.store = store;
    config.passOnStoreError = true;
  }

  return rateLimit(config);
}

module.exports = { createRateLimiter };
