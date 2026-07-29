const apn = require('apn');
const { prisma } = require('../../config/db');
const env = require('../../config/env');
const logger = require('../../utils/logger');

let provider = null;
let providerInitFailed = false;

function isConfigured() {
  return Boolean(env.APPLE_VOIP.keyId && env.APPLE_VOIP.teamId && env.APPLE_VOIP.privateKey && env.APPLE_VOIP.bundleId);
}

function getProvider() {
  if (provider || providerInitFailed) return provider;
  if (!isConfigured()) return null;
  try {
    provider = new apn.Provider({
      token: {
        key: env.APPLE_VOIP.privateKey.replace(/\\n/g, '\n'),
        keyId: env.APPLE_VOIP.keyId,
        teamId: env.APPLE_VOIP.teamId,
      },
      production: env.APPLE_VOIP.production,
    });
  } catch (err) {
    providerInitFailed = true;
    logger.error('[VoIP push] provider init failed', { err: err.message });
    return null;
  }
  return provider;
}

/** Sends an incoming-call VoIP push to every iOS device this user has
 *  registered a PushKit token for. No-op (silently) if the VoIP key isn't
 *  configured yet or the user has no VoIP-capable devices — callers still
 *  get the regular FCM-based ringing push either way, this is additive. */
async function sendIncomingCallVoipPush(userId, { callId, channelName, callerName, callerId }) {
  const client = getProvider();
  if (!client) return;

  const devices = await prisma.fcmDevice.findMany({
    where: { userId, voipToken: { not: null } },
    select: { voipToken: true },
  });
  if (devices.length === 0) return;

  const note = new apn.Notification();
  note.topic = `${env.APPLE_VOIP.bundleId}.voip`;
  note.pushType = 'voip';
  note.priority = 10;
  note.payload = { callId, channelName, callerName, callerId };

  await Promise.all(
    devices.map(async ({ voipToken }) => {
      try {
        const result = await client.send(note, voipToken);
        if (result.failed?.length) {
          const reason = result.failed[0]?.response?.reason;
          logger.warn('[VoIP push] delivery failed', { reason });
          // Token permanently invalid — stop trying it.
          if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
            await prisma.fcmDevice.updateMany({ where: { voipToken }, data: { voipToken: null } }).catch(() => {});
          }
        }
      } catch (err) {
        logger.error('[VoIP push] send error', { err: err.message });
      }
    }),
  );
}

async function registerVoipToken(userId, voipToken, deviceFcmToken) {
  // A VoIP token belongs to whichever device row is currently this user's
  // most-recently-registered one — matches how registerFcmToken already
  // works per-device rather than per-user.
  const existing = await prisma.fcmDevice.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
  if (existing) {
    await prisma.fcmDevice.update({ where: { id: existing.id }, data: { voipToken } });
  } else {
    // No FCM device row yet (VoIP token can register before the FCM token
    // does) — create a placeholder row keyed on the VoIP token itself so it
    // isn't dropped; registerFcmToken's own upsert-by-token will fill in the
    // fcmToken field into this same row once it runs.
    await prisma.fcmDevice.upsert({
      where: { token: `voip-only:${voipToken}` },
      create: { userId, token: `voip-only:${voipToken}`, platform: 'ios', voipToken },
      update: { voipToken },
    });
  }
}

module.exports = { sendIncomingCallVoipPush, registerVoipToken, isConfigured };
