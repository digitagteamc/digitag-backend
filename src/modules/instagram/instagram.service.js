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
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function startVerification(userId, instagramUrl) {
  const username = extractInstagramUsername(instagramUrl);
  if (!username) throw ApiError.badRequest('Invalid Instagram URL or username');

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

/**
 * Called from the webhook handler.
 * Resolves the sender's username via Instagram Graph API, then matches the code.
 */
async function resolveIgsidToProfile(igScopedId) {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.error('[Instagram] No access token configured');
    return null;
  }
  try {
    const url = `https://graph.instagram.com/v21.0/${igScopedId}?fields=username&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[Instagram] IGSID ${igScopedId} resolved:`, JSON.stringify(data));
    if (!data.username) return null;
    return {
      username: data.username.toLowerCase(),
      followersCount: null,
    };
  } catch (err) {
    console.error('[Instagram] IGSID resolve error:', err.message);
    return null;
  }
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

  console.log(`[Instagram] Found pending verification for @${record.instagramUsername}`);

  const senderProfile = await resolveIgsidToProfile(senderIgScopedId);
  if (!senderProfile) {
    console.error('[Instagram] Could not resolve sender profile — verification blocked');
    return;
  }

  console.log(`[Instagram] Sender: @${senderProfile.username}, Expected: @${record.instagramUsername}, Followers: ${senderProfile.followersCount}`);

  if (senderProfile.username !== record.instagramUsername.toLowerCase()) {
    console.warn(`[Instagram] Username mismatch — rejecting`);
    return;
  }

  await prisma.instagramVerification.update({
    where: { id: record.id },
    data: { status: 'VERIFIED', verifiedAt: now },
  });

  // Save followers count to creator or freelancer profile
  if (senderProfile.followersCount !== null) {
    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { role: true },
    });
    if (user?.role === 'CREATOR') {
      await prisma.creatorProfile.updateMany({
        where: { userId: record.userId },
        data: { instagramFollowers: senderProfile.followersCount },
      });
    } else if (user?.role === 'FREELANCER') {
      await prisma.freelancerProfile.updateMany({
        where: { userId: record.userId },
        data: { instagramFollowers: senderProfile.followersCount },
      });
    }
    console.log(`[Instagram] ✅ Verified @${senderProfile.username} — followers: ${senderProfile.followersCount}`);
  } else {
    console.log(`[Instagram] ✅ Verified @${senderProfile.username} — followers count unavailable`);
  }
}

module.exports = {
  startVerification,
  getVerificationStatus,
  handleWebhookMessage,
  extractInstagramUsername,
};
