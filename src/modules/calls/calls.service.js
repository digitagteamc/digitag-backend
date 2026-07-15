const crypto = require('crypto');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const env = require('../../config/env');
const push = require('../../services/push/push.service');
const { assertNotBlocked } = require('../blocks/block.service');

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

async function initiateCall(callerId, calleeId) {
  if (callerId === calleeId) throw ApiError.badRequest('Cannot call yourself');
  await assertNotBlocked(callerId, calleeId);

  // Same product rule as messaging: contact is open only while a collaboration
  // is ACCEPTED — completing it closes calls too. Enforced here, not just in
  // the UI, so a stale client can't ring someone after the collab ended.
  const activeCollab = await prisma.collaboration.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: callerId, receiverId: calleeId },
        { senderId: calleeId, receiverId: callerId },
      ],
    },
    select: { id: true },
  });
  if (!activeCollab) {
    throw ApiError.forbidden('Calls are available only during an active collaboration');
  }

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
      select: { id: true },
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

  // Data-only at the top level (no `notification` field): on Android, a
  // notification payload alongside data suppresses the JS background handler,
  // and we need setBackgroundMessageHandler to fire so notifee can show the
  // full-screen ringing UI. iOS won't deliver data-only pushes in the
  // background, so the message carries an APNs alert override — visible
  // banner + sound — which is what actually makes iPhones ring.
  // Ringing itself is not discretionary the way a chat/collab push is —
  // exempt it from the Notifications toggle so turning that off can't make
  // a user silently unreachable for calls.
  await push.sendToUser(calleeId, (token) =>
    push.callAlertMessage(
      token,
      { type: 'INCOMING_CALL', callId: call.id, channelName, callerName, callerId },
      { title: `📞 ${callerName}`, body: 'Incoming DigiTag call — tap to answer' },
    ),
  { respectNotificationSetting: false });

  return { callId: call.id, channelName, token, appId: env.AGORA_APP_ID };
}

async function acceptCall(callId, calleeId) {
  const call = await prisma.call.findFirst({
    where: { id: callId, calleeId, status: 'RINGING' },
  });
  if (!call) throw ApiError.notFound('Call not found or already ended');

  const token = generateAgoraToken(call.channelName);

  await prisma.call.update({
    where: { id: callId },
    data: { status: 'ACTIVE', startedAt: new Date() },
  });

  await push.sendToUser(call.callerId, (t) =>
    push.dataMessage(t, { type: 'CALL_ACCEPTED', callId, channelName: call.channelName }),
  { respectNotificationSetting: false });

  return { channelName: call.channelName, token, appId: env.AGORA_APP_ID };
}

async function declineCall(callId, calleeId) {
  const call = await prisma.call.findFirst({
    where: { id: callId, calleeId, status: 'RINGING' },
  });
  if (!call) throw ApiError.notFound('Call not found');

  await prisma.call.update({ where: { id: callId }, data: { status: 'DECLINED' } });

  await push.sendToUser(call.callerId, (t) =>
    push.dataMessage(t, { type: 'CALL_DECLINED', callId }),
  { respectNotificationSetting: false });
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

  await push.sendToUser(otherUserId, (t) =>
    push.dataMessage(t, { type: 'CALL_ENDED', callId }),
  { respectNotificationSetting: false });
}

async function registerFcmToken(userId, fcmToken, platform) {
  await push.registerDevice(userId, fcmToken, platform);
}

async function unregisterFcmToken(userId, fcmToken) {
  await push.unregisterDevice(userId, fcmToken);
}

// Lets the callee check whether a call is still ringing before showing the
// incoming-call UI — a stale notification tap otherwise rings forever for a
// call that already ended.
async function getCall(callId, userId) {
  const call = await prisma.call.findFirst({
    where: { id: callId, OR: [{ callerId: userId }, { calleeId: userId }] },
    select: { id: true, status: true, callerId: true, calleeId: true, startedAt: true, endedAt: true },
  });
  if (!call) throw ApiError.notFound('Call not found');
  return call;
}

module.exports = { initiateCall, acceptCall, declineCall, endCall, registerFcmToken, unregisterFcmToken, getCall };
