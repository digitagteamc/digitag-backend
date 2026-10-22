const { prisma } = require('../config/db');
const logger = require('../utils/logger');
const { runExclusive, JOB_LOCKS } = require('./jobLock');

// RefreshToken rows are only ever marked revoked/used, never deleted, so the
// table grows by one row per login/refresh forever. Once a token is past its
// own expiresAt it can never be redeemed again (rotateRefreshToken already
// rejects it), so it's safe to prune.
//
// Runs under a cross-process lock so only one API process does the delete.
async function pruneExpiredRefreshTokens() {
  try {
    await runExclusive(
      JOB_LOCKS.PRUNE_REFRESH_TOKENS,
      async () => {
        const { count } = await prisma.refreshToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        if (count > 0) {
          logger.info(`Pruned ${count} expired refresh token(s)`);
        }
      },
      { timeoutMs: 5 * 60 * 1000 },
    );
  } catch (err) {
    logger.error('Refresh token prune failed', { err });
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function schedulePruneRefreshTokens() {
  pruneExpiredRefreshTokens();
  return setInterval(pruneExpiredRefreshTokens, DAY_MS).unref();
}

module.exports = { pruneExpiredRefreshTokens, schedulePruneRefreshTokens };
