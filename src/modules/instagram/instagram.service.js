const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const env = require('../../config/env');

const EXPIRY_MINUTES = 10;

/**
 * Extracts Instagram username from a URL, @handle, or plain username.
 * e.g. https://instagram.com/username/ → "username"
 *      @username → "username"
 *      username  → "username"
 */
function extractInstagramUsername(input) {
  if (!input) return null;
  const trimmed = input.trim().replace(/^@/, '');
  const match = trimmed.match(/(?:instagram\.com\/)([A-Za-z0-9_.]+)/i);
  if (match) return match[1].toLowerCase();
  if (/^[A-Za-z0-9_.]{1,30}$/.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function fetchFollowerCount(igScopedId) {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const url = `https://graph.facebook.com/v21.0/${igScopedId}?fields=follower_count&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[Instagram] IGSID ${igScopedId} follower data:`, JSON.stringify(data));
    if (typeof data.follower_count === 'number') return data.follower_count;
    return null;
  } catch (err) {
    console.error('[Instagram] Follower count fetch error:', err.message);
    return null;
  }
}

async function startVerification(userId, instagramUrl) {
  const username = extractInstagramUsername(instagramUrl);
  if (!username) throw ApiError.badRequest('Invalid Instagram URL or username');

  // Block if this handle is already verified by a different user
  const alreadyVerified = await prisma.instagramVerification.findFirst({
    where: { instagramUsername: username, status: 'VERIFIED', NOT: { userId } },
    select: { id: true },
  });
  if (alreadyVerified) {
    throw ApiError.conflict('This Instagram account is already verified by another DigiTag user');
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  // Expire any previous pending verifications for this user
  await prisma.instagramVerification.updateMany({
    where: { userId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });

  const record = await prisma.instagramVerification.create({
    data: {
      userId,
      instagramUrl: instagramUrl.trim(),
      instagramUsername: username,
      verificationCode: code,
      expiresAt,
    },
  });

  return {
    id: record.id,
    code: record.verificationCode,
    instagramUsername: record.instagramUsername,
    expiresAt: record.expiresAt,
    digiTagInstagram: env.DIGITAG_INSTAGRAM_USERNAME || 'digitag.official',
  };
}

async function getVerificationStatus(userId, id) {
  const record = await prisma.instagramVerification.findFirst({
    where: { id, userId },
    select: { id: true, status: true, expiresAt: true, verifiedAt: true, instagramUsername: true },
  });
  if (!record) throw ApiError.notFound('Verification record not found');

  // Auto-expire if deadline passed and still pending
  if (record.status === 'PENDING' && record.expiresAt < new Date()) {
    await prisma.instagramVerification.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    return { id, status: 'EXPIRED', instagramUsername: record.instagramUsername };
  }

  return {
    id: record.id,
    status: record.status,
    verifiedAt: record.verifiedAt,
    instagramUsername: record.instagramUsername,
  };
}

async function handleWebhookMessage(senderIgScopedId, messageText) {
  console.log(`[Instagram] Webhook DM received — sender: ${senderIgScopedId}, text: "${messageText}"`);
  if (!messageText) return;
  const code = messageText.trim();
  if (!/^\d{6}$/.test(code)) {
    console.log(`[Instagram] Skipping — not a 6-digit code: "${code}"`);
    return;
  }

  const now = new Date();
  const record = await prisma.instagramVerification.findFirst({
    where: {
      verificationCode: code,
      status: 'PENDING',
      expiresAt: { gt: now },
    },
  });

  if (!record) {
    console.log(`[Instagram] No pending verification found for code: ${code}`);
    return;
  }

  console.log(`[Instagram] Code matched for @${record.instagramUsername} — marking VERIFIED`);

  await prisma.instagramVerification.update({
    where: { id: record.id },
    data: { status: 'VERIFIED', verifiedAt: now },
  });

  // Try to auto-fill follower count from the sender's IGSID
  const followerCount = await fetchFollowerCount(senderIgScopedId);
  if (followerCount !== null) {
    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { role: true },
    });
    if (user?.role === 'CREATOR') {
      await prisma.creatorProfile.updateMany({
        where: { userId: record.userId },
        data: { instagramFollowers: followerCount },
      });
    } else if (user?.role === 'FREELANCER') {
      await prisma.freelancerProfile.updateMany({
        where: { userId: record.userId },
        data: { instagramFollowers: followerCount },
      });
    }
    console.log(`[Instagram] ✅ Verified @${record.instagramUsername} — followers: ${followerCount}`);
  } else {
    console.log(`[Instagram] ✅ Verified @${record.instagramUsername} (follower count unavailable via API)`);
  }
}

module.exports = {
  startVerification,
  getVerificationStatus,
  handleWebhookMessage,
};
