const crypto = require('crypto');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const env = require('../../config/env');
const admin = require('../../config/firebase');

const TOKEN_EXPIRY_SECONDS = 3600;

function generateChannelName() {
  return crypto.randomUUID().replace(/-/g, '');
}

function generateAgoraToken(channelName) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
  return RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    channelName,
    0,
    RtcRole.PUBLISHER,
    expiresAt
  );
}

async function sendFcm(fcmToken, data, notification = null) {
  if (!fcmToken) return;
  try {
    const msg = {
      token: fcmToken,
      data,
      android: { priority: 'high', ttl: 30000 },
      apns: { headers: { 'apns-priority': '10' } },
    };
    if (notification) msg.notification = notification;
    await admin.messaging().send(msg);
  } catch (err) {
    console.error('[Calls] FCM error:', err.message);
  }
}

async function initiateCall(callerId, calleeId) {
  if (callerId === calleeId) throw ApiError.badRequest('Cannot call yourself');

  const [caller, callee] = await Promise.all([
    prisma.user.findUnique({
      where: { id: callerId },
      select: {
        id: true,
        creatorProfile: { select: { name: true, profilePicture: true } },
        freelancerProfile: { select: { name: true, profilePicture: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: calleeId },
      select: { id: true, fcmToken: true },
    }),
  ]);

  if (!callee) throw ApiError.notFound('User not found');

  // Expire any existing ringing calls from this caller
  await prisma.call.updateMany({
    where: { callerId, status: 'RINGING' },
    data: { status: 'MISSED' },
  });

  const channelName = generateChannelName();
  const token = generateAgoraToken(channelName);

  const call = await prisma.call.create({
    data: { callerId, calleeId, channelName },
  });

  const callerName =
    caller?.creatorProfile?.name ||
    caller?.freelancerProfile?.name ||
    'DigiTag User';

  // Data-only message (no `notification` field): on Android, including a
  // notification payload alongside data suppresses the JS background
  // handler — the OS just shows a plain banner instead. Keeping this
  // data-only ensures setBackgroundMessageHandler always fires so we can
  // display a proper full-screen ringing call notification via notifee.
  await sendFcm(callee.fcmToken, {
    type: 'INCOMING_CALL',
    callId: call.id,
    channelName,
    callerName,
    callerId,
  });

  return { callId: call.id, channelName, token, appId: env.AGORA_APP_ID };
}

async function acceptCall(callId, calleeId) {
  const call = await prisma.call.findFirst({
    where: { id: callId, calleeId, status: 'RINGING' },
    include: { caller: { select: { fcmToken: true } } },
  });
  if (!call) throw ApiError.notFound('Call not found or already ended');

  const token = generateAgoraToken(call.channelName);

  await prisma.call.update({
    where: { id: callId },
    data: { status: 'ACTIVE', startedAt: new Date() },
  });

  await sendFcm(call.caller.fcmToken, {
    type: 'CALL_ACCEPTED',
    callId,
    channelName: call.channelName,
  });

  return { channelName: call.channelName, token, appId: env.AGORA_APP_ID };
}

async function declineCall(callId, calleeId) {
  const call = await prisma.call.findFirst({
    where: { id: callId, calleeId, status: 'RINGING' },
    include: { caller: { select: { fcmToken: true } } },
  });
  if (!call) throw ApiError.notFound('Call not found');

  await prisma.call.update({ where: { id: callId }, data: { status: 'DECLINED' } });

  await sendFcm(call.caller.fcmToken, { type: 'CALL_DECLINED', callId });
}

async function endCall(callId, userId) {
  const call = await prisma.call.findFirst({
    where: { id: callId, OR: [{ callerId: userId }, { calleeId: userId }] },
  });
  if (!call) throw ApiError.notFound('Call not found');

  await prisma.call.update({
    where: { id: callId },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { fcmToken: true },
  });

  await sendFcm(other?.fcmToken, { type: 'CALL_ENDED', callId });
}

async function registerFcmToken(userId, fcmToken) {
  await prisma.user.update({ where: { id: userId }, data: { fcmToken } });
}

module.exports = { initiateCall, acceptCall, declineCall, endCall, registerFcmToken };
