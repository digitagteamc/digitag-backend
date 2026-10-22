const { prisma } = require('../config/db');
const logger = require('../utils/logger');
const { executeBroadcast } = require('../modules/admin/admin.service');
const { runExclusive, JOB_LOCKS } = require('./jobLock');

// A large broadcast fans out push sends to every recipient; allow well beyond
// that before the lock lapses and another process could pick it up again.
const SEND_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

// Scheduled broadcasts (Broadcast.status === 'SCHEDULED') sit until their
// scheduledFor time arrives — this poll picks up anything due and sends it.
// executeBroadcast re-resolves recipients fresh at send time rather than
// reusing whatever was computed when the broadcast was scheduled, since the
// matching audience may have shifted in the meantime — the correct behavior
// for a future-dated send.
//
// Every API process runs this poll, so it runs under a cross-process lock:
// without it each process would pick up the same due broadcast and users
// would get the notification once per process.
async function sendDueBroadcasts() {
  try {
    await runExclusive(
      JOB_LOCKS.SEND_SCHEDULED_BROADCASTS,
      async () => {
        const due = await prisma.broadcast.findMany({
          where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
        });
        for (const broadcast of due) {
          try {
            await executeBroadcast(broadcast);
          } catch (err) {
            logger.error('Scheduled broadcast send failed', { broadcastId: broadcast.id, err });
            await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: 'FAILED' } }).catch(() => {});
          }
        }
      },
      { timeoutMs: SEND_LOCK_TIMEOUT_MS },
    );
  } catch (err) {
    logger.error('Scheduled broadcast poll failed', { err });
  }
}

const POLL_MS = 60 * 1000;

function scheduleSendBroadcasts() {
  sendDueBroadcasts();
  return setInterval(sendDueBroadcasts, POLL_MS).unref();
}

module.exports = { sendDueBroadcasts, scheduleSendBroadcasts };
