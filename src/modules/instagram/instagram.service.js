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

/** Verifies Meta's X-Hub-Signature-256 header ("sha256=<hex>") against the raw
 *  request body, so the webhook route can't be driven by arbitrary POSTs from
 *  anyone who finds the URL — only requests actually signed by Meta with our
 *  app secret. */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!env.INSTAGRAM_APP_SECRET || !signatureHeader || !rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', env.INSTAGRAM_APP_SECRET).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function fetchSenderProfile(igScopedId) {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;
  try {
    // IGSID lookup: returns name, username, profile_pic (not followers_count)
    const url = `https://graph.instagram.com/v21.0/${igScopedId}?fields=id,name,username,profile_pic&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchFollowerCount(username) {
  // Requires INSTAGRAM_PAGE_TOKEN (Facebook Page Access Token, EAA...) for Business Discovery API
  const pageToken = env.INSTAGRAM_PAGE_TOKEN;
  const igAccountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!pageToken || !igAccountId) return null;
  try {
    const url = `https://graph.facebook.com/v21.0/${igAccountId}?fields=business_discovery.fields(followers_count,username)&username=${encodeURIComponent(username)}&access_token=${pageToken}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[Instagram] Business discovery for @${username}:`, JSON.stringify(data));
    if (typeof data.business_discovery?.followers_count === 'number') {
      return data.business_discovery.followers_count;
    }
    return null;
  } catch (err) {
    console.error('[Instagram] Follower count fetch error:', err.message);
    return null;
  }
}

async function startVerification(userId, instagramUrl) {
  const username = extractInstagramUsername(instagramUrl);
  if (!username) throw ApiError.badRequest('Invalid Instagram URL or username');

  // Block if this handle is already verified under a genuinely different
  // account — but a sibling role-profile of the SAME account (same person,
  // switched roles via the multi-profile feature) isn't "another" user, so
  // exclude the whole account's users, not just this one row, when we know
  // the account.
  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { accountId: true } });
  const alreadyVerified = await prisma.instagramVerification.findFirst({
    where: {
      instagramUsername: username,
      status: 'VERIFIED',
      NOT: currentUser?.accountId ? { user: { accountId: currentUser.accountId } } : { userId },
    },
    select: { id: true },
  });
  if (alreadyVerified) {
    throw ApiError.conflict('This Instagram account is already verified by another DigiTag user');
  }

  // Already connected by this same user — nothing to re-verify.
  const alreadyOwned = await prisma.instagramVerification.findFirst({
    where: { userId, instagramUsername: username, status: 'VERIFIED' },
    select: { id: true },
  });
  if (alreadyOwned) {
    throw ApiError.conflict('You have already connected this Instagram account');
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

/** Returns an Instagram account already VERIFIED under a sibling role-profile
 *  of the same account (same person, different User row via multi-profile),
 *  if any — so the app can offer to reuse it instantly instead of requiring
 *  a fresh DM verification. Not this user's own already-connected accounts. */
async function getReusableAccount(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountId: true } });
  if (!user?.accountId) return null;

  const existing = await prisma.instagramVerification.findFirst({
    where: {
      status: 'VERIFIED',
      NOT: { userId },
      user: { accountId: user.accountId },
    },
    select: { instagramUsername: true, followers: true },
    orderBy: { verifiedAt: 'desc' },
  });
  return existing;
}

/** Instantly links an Instagram account already verified under a sibling
 *  role-profile (same account) to this user — no new DM round-trip needed,
 *  since ownership was already proven for this same person. */
async function reuseVerifiedAccount(userId, instagramUsername) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountId: true, role: true } });
  if (!user?.accountId) throw ApiError.badRequest('No linked account found');

  const alreadyOwned = await prisma.instagramVerification.findFirst({
    where: { userId, instagramUsername, status: 'VERIFIED' },
  });
  if (alreadyOwned) {
    return { id: alreadyOwned.id, instagramUsername, followers: alreadyOwned.followers };
  }

  const source = await prisma.instagramVerification.findFirst({
    where: { status: 'VERIFIED', instagramUsername, NOT: { userId }, user: { accountId: user.accountId } },
  });
  if (!source) throw ApiError.notFound('No matching verified account found to reuse');

  const record = await prisma.instagramVerification.create({
    data: {
      userId,
      instagramUrl: source.instagramUrl,
      instagramUsername,
      verificationCode: generateCode(),
      status: 'VERIFIED',
      verifiedAt: new Date(),
      followers: source.followers,
      expiresAt: source.expiresAt,
    },
  });

  if (source.followers !== null) {
    if (user.role === 'CREATOR') {
      await prisma.creatorProfile.updateMany({ where: { userId }, data: { instagramFollowers: source.followers } });
    } else if (user.role === 'FREELANCER') {
      await prisma.freelancerProfile.updateMany({ where: { userId }, data: { instagramFollowers: source.followers } });
    }
  }

  return { id: record.id, instagramUsername, followers: record.followers };
}

async function listAccounts(userId) {
  const accounts = await prisma.instagramVerification.findMany({
    where: { userId, status: 'VERIFIED' },
    select: { id: true, instagramUsername: true, followers: true, verifiedAt: true },
    orderBy: { verifiedAt: 'asc' },
  });
  // The first-ever verified account is permanently connected and can't be
  // removed — flag it so the app can hide the remove option for it specifically.
  return accounts.map((acc, i) => ({ ...acc, isPrimary: i === 0 }));
}

async function removeAccount(userId, id) {
  const record = await prisma.instagramVerification.findFirst({ where: { id, userId, status: 'VERIFIED' } });
  if (!record) throw ApiError.notFound('Connected Instagram account not found');

  // The first Instagram account verified (typically at signup) is
  // permanent — only accounts added after it can be disconnected.
  const earliest = await prisma.instagramVerification.findFirst({
    where: { userId, status: 'VERIFIED' },
    orderBy: { verifiedAt: 'asc' },
    select: { id: true },
  });
  if (earliest?.id === id) {
    throw ApiError.forbidden('Your first verified Instagram account cannot be removed');
  }

  await prisma.instagramVerification.update({ where: { id }, data: { status: 'REMOVED' } });

  // Signup separately writes the handle onto the profile itself
  // (CreatorProfile/FreelancerProfile.instagramHandle) alongside creating
  // this verification record. If this was that same handle, clear it there
  // too — otherwise a since-removed account's icon/link keeps reappearing
  // on the profile with no way to remove it, since that field isn't driven
  // by this verification list at all.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const staleHandleWhere = { userId, instagramHandle: { equals: record.instagramUsername, mode: 'insensitive' } };
  if (user?.role === 'CREATOR') {
    await prisma.creatorProfile.updateMany({ where: staleHandleWhere, data: { instagramHandle: null, instagramFollowers: null } });
  } else if (user?.role === 'FREELANCER') {
    await prisma.freelancerProfile.updateMany({ where: staleHandleWhere, data: { instagramHandle: null, instagramFollowers: null } });
  }
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

  // The code alone isn't proof of ownership — anyone who sees it (screenshot,
  // shared screen, guessed during the window) could DM it from an unrelated
  // account. Confirm the DM actually came from the same Instagram account the
  // user typed into the app before marking anything verified.
  const senderProfile = await fetchSenderProfile(senderIgScopedId);
  const senderUsername = senderProfile?.username?.toLowerCase();
  if (!senderUsername || senderUsername !== record.instagramUsername) {
    console.log(`[Instagram] Code matched but sender @${senderUsername || 'unknown'} does not match entered username @${record.instagramUsername} — marking FAILED`);
    await prisma.instagramVerification.update({ where: { id: record.id }, data: { status: 'FAILED' } });
    return;
  }

  console.log(`[Instagram] Code matched for @${record.instagramUsername} — marking VERIFIED`);

  // Fetch follower count via Business Discovery (needs INSTAGRAM_PAGE_TOKEN)
  const followerCount = await fetchFollowerCount(record.instagramUsername);

  await prisma.instagramVerification.update({
    where: { id: record.id },
    data: { status: 'VERIFIED', verifiedAt: now, followers: followerCount },
  });

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { role: true },
  });

  if (followerCount !== null && user) {
    if (user.role === 'CREATOR') {
      await prisma.creatorProfile.updateMany({ where: { userId: record.userId }, data: { instagramFollowers: followerCount } });
    } else if (user.role === 'FREELANCER') {
      await prisma.freelancerProfile.updateMany({ where: { userId: record.userId }, data: { instagramFollowers: followerCount } });
    }
  }

  console.log(`[Instagram] ✅ Verified @${record.instagramUsername} — followers: ${followerCount ?? 'N/A'}, sender name: ${senderProfile?.name ?? 'N/A'}`);
}

module.exports = {
  startVerification,
  getVerificationStatus,
  listAccounts,
  removeAccount,
  handleWebhookMessage,
  verifyWebhookSignature,
  getReusableAccount,
  reuseVerifiedAccount,
};
