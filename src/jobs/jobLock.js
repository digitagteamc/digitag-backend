const { prisma } = require('../config/db');

// Runs `fn` only if no other process currently holds the lock for `key`, so
// a periodic job does its work once even when several API processes (PM2
// cluster workers, multiple servers) all schedule it. Uses a Postgres
// transaction-level advisory lock: it is held for the life of the
// transaction and released automatically on commit, rollback, or if the
// process dies mid-run — no stuck locks to clean up.
//
// Returns fn's result, or undefined when another process holds the lock.
// `timeoutMs` must exceed the longest expected run; when it elapses the lock
// is released even if fn is still working.
async function runExclusive(key, fn, { timeoutMs }) {
  return prisma.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
      if (!locked) return undefined;
      return fn();
    },
    { maxWait: 10 * 1000, timeout: timeoutMs },
  );
}

// One key per job. Arbitrary but fixed — changing a value lets two
// deploys' processes run the same job at once during a rollout.
const JOB_LOCKS = {
  SEND_SCHEDULED_BROADCASTS: 726001,
  PRUNE_REFRESH_TOKENS: 726002,
};

module.exports = { runExclusive, JOB_LOCKS };
