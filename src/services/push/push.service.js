const { prisma } = require('../../config/db');
const admin = require('../../config/firebase');
const logger = require('../../utils/logger');

// FCM error codes that mean the token is permanently dead (app uninstalled,
// token rotated, etc.) — safe to delete the device row so we stop pushing to it.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Every push token for a user: all FcmDevice rows plus the legacy
 *  User.fcmToken column (older app builds only write the legacy column). */
async function getTokensForUser(userId) {
  const [devices, user] = await Promise.all([
    prisma.fcmDevice.findMany({ where: { userId }, select: { token: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } }),
  ]);
  const tokens = new Set(devices.map((d) => d.token));
  if (user?.fcmToken) tokens.add(user.fcmToken);
  return [...tokens];
}

async function pruneDeadToken(token) {
  await Promise.allSettled([
    prisma.fcmDevice.deleteMany({ where: { token } }),
    prisma.user.updateMany({ where: { fcmToken: token }, data: { fcmToken: null } }),
  ]);
}

// Types with their own dedicated history/unread tracking elsewhere in the
// app — persisting them as generic Notification rows too would just be a
// duplicate, noisier copy of what the Messages tab (and calls, which are
// data-only and never reach this check anyway) already show.
const SKIP_NOTIFICATION_PERSIST = new Set(['NEW_MESSAGE']);

/** Send one FCM message to every device a user is logged in on.
 *  `buildMessage(token)` returns the full messaging payload for that token.
 *  Dead tokens are pruned so logged-out/uninstalled devices stop receiving.
 *  `respectNotificationSetting` (default true) checks Privacy Settings'
 *  pushNotificationsEnabled first — pass false for call-critical pushes
 *  (ringing, call lifecycle events), which aren't discretionary the way a
 *  chat/collab notification is.
 *
 *  Any message built with a `notification` field (i.e. via notificationMessage,
 *  not the data-only call-signaling builders), and not in
 *  SKIP_NOTIFICATION_PERSIST, is also persisted as a Notification row,
 *  regardless of push-eligibility — the in-app Notifications tab is the
 *  durable source of truth; the push itself is just the interrupt on top
 *  of it. */
async function sendToUser(userId, buildMessage, { respectNotificationSetting = true } = {}) {
  const sample = buildMessage('_persist_probe_');
  if (sample.notification && !SKIP_NOTIFICATION_PERSIST.has(sample.data?.type)) {
    await prisma.notification.create({
      data: {
        userId,
        type: sample.data?.type || 'GENERIC',
        title: sample.notification.title,
        body: sample.notification.body,
        data: sample.data || {},
      },
    }).catch((err) => logger.error('[Notification] persist failed', { err: err.message }));
  }

  if (respectNotificationSetting) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushNotificationsEnabled: true } });
    if (user && user.pushNotificationsEnabled === false) return;
  }

  const tokens = await getTokensForUser(userId);
  if (tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await admin.messaging().send(buildMessage(token));
      } catch (err) {
        if (DEAD_TOKEN_CODES.has(err.code)) {
          await pruneDeadToken(token);
        } else {
          logger.error('[FCM] send failed', { err: err.message });
        }
      }
    }),
  );
}

// FCM's multicast API caps at 500 tokens per call.
const MULTICAST_CHUNK_SIZE = 500;

/** Send one notification to many users at once — for high-fanout cases (e.g.
 *  "new post in your category") where a sendToUser-per-user loop would mean
 *  one FCM network call per recipient. Uses sendEachForMulticast (up to 500
 *  tokens per call) instead, so 5000 recipients is ~10 calls, not 5000.
 *  `buildMessage` is called once (its `token` field is discarded — multicast
 *  takes a `tokens` array instead) so it can reuse the same builders
 *  (notificationMessage etc.) as sendToUser. Every recipient's preferences
 *  (pushNotificationsEnabled, and whatever else the caller already filtered
 *  by) must be checked by the caller before building the userIds list —
 *  unlike sendToUser, this doesn't check per-user settings itself since
 *  doing so per-user would defeat the point of batching.
 *
 *  `skipPersist` + `broadcastId`: admin Broadcasts need their Notification
 *  rows tagged with which Broadcast created them (for read-rate tracking),
 *  which this function's own generic persist block can't do — the caller
 *  persists with the right broadcastId itself and passes skipPersist so this
 *  doesn't insert a second, untagged copy. Returns { sentCount } either way
 *  (previously returned nothing) so callers can record it. */
async function sendBroadcast(userIds, buildMessage, { skipPersist = false, broadcastId = null } = {}) {
  if (!userIds.length) return { sentCount: 0 };

  const { token: _ignored, ...messageBody } = buildMessage('_multicast_probe_');
  if (messageBody.notification && !skipPersist) {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: messageBody.data?.type || 'GENERIC',
        title: messageBody.notification.title,
        body: messageBody.notification.body,
        data: messageBody.data || {},
        broadcastId,
      })),
    }).catch((err) => logger.error('[Notification] batch persist failed', { err: err.message }));
  }

  const [devices, users] = await Promise.all([
    prisma.fcmDevice.findMany({ where: { userId: { in: userIds } }, select: { token: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { fcmToken: true } }),
  ]);
  const tokens = [...new Set([
    ...devices.map((d) => d.token),
    ...users.map((u) => u.fcmToken).filter(Boolean),
  ])];
  if (!tokens.length) return { sentCount: 0 };

  let sentCount = 0;
  for (let i = 0; i < tokens.length; i += MULTICAST_CHUNK_SIZE) {
    const batch = tokens.slice(i, i + MULTICAST_CHUNK_SIZE);
    try {
      const res = await admin.messaging().sendEachForMulticast({ tokens: batch, ...messageBody });
      sentCount += res.successCount;
      const deadTokens = batch.filter((_, idx) => {
        const r = res.responses[idx];
        return !r.success && DEAD_TOKEN_CODES.has(r.error?.code);
      });
      if (deadTokens.length) await Promise.all(deadTokens.map(pruneDeadToken));
    } catch (err) {
      logger.error('[FCM] broadcast send failed', { err: err.message });
    }
  }
  return { sentCount };
}

/** Data-only push (Android headless handler) with an APNs alert override so
 *  iOS — which won't reliably deliver data-only messages in the background —
 *  still shows a visible, sounding notification. Used for incoming calls. */
function callAlertMessage(token, data, { title, body }) {
  return {
    token,
    data,
    android: { priority: 'high', ttl: 30000 },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          'interruption-level': 'time-sensitive',
        },
      },
    },
  };
}

/** Silent data push: Android gets normal high-priority data; iOS gets a
 *  background (content-available) push so in-app state can update. Used for
 *  call lifecycle events (accepted/declined/ended). */
function dataMessage(token, data) {
  return {
    token,
    data,
    android: { priority: 'high', ttl: 30000 },
    apns: {
      headers: { 'apns-priority': '5', 'apns-push-type': 'background' },
      payload: { aps: { 'content-available': 1 } },
    },
  };
}

/** Standard visible notification (chat messages etc.) — OS renders it on both
 *  platforms when the app is backgrounded; data rides along for tap routing. */
function notificationMessage(token, data, { title, body }) {
  return {
    token,
    data,
    notification: { title, body },
    android: { priority: 'high' },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { sound: 'default' } },
    },
  };
}

async function registerDevice(userId, token, platform) {
  // A physical device has one FCM token per app install — if another user row
  // still claims this token (previous account on the same phone), move it.
  await prisma.fcmDevice.upsert({
    where: { token },
    create: { userId, token, platform: platform || null },
    update: { userId, platform: platform || null },
  });
  // Legacy column kept in sync so anything still reading it keeps working.
  await prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
}

async function unregisterDevice(userId, token) {
  await Promise.allSettled([
    prisma.fcmDevice.deleteMany({ where: { token } }),
    prisma.user.updateMany({ where: { id: userId, fcmToken: token }, data: { fcmToken: null } }),
  ]);
}

module.exports = {
  sendToUser,
  sendBroadcast,
  callAlertMessage,
  dataMessage,
  notificationMessage,
  registerDevice,
  unregisterDevice,
};
