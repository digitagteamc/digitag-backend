const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const env = require('../../config/env');
const { prisma } = require('../../config/db');

function signAccessToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    type: 'access',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

function signRefreshToken(user, jti) {
  const payload = { sub: user.id, jti, type: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function expiryToDate(expiresIn) {
  const match = /^(\d+)([smhdw])$/.exec(expiresIn);
  if (!match) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit];
  return new Date(Date.now() + n * mult);
}

async function issueTokens(user, context = {}) {
  const accessToken = signAccessToken(user);
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken(user, jti);

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: context.userAgent || null,
      ipAddress: context.ipAddress || null,
      expiresAt: expiryToDate(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  return { accessToken, refreshToken };
}

async function rotateRefreshToken(oldToken, context = {}) {
  const payload = verifyRefreshToken(oldToken);
  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new Error('Refresh token invalid');
  }
  if (record.tokenHash !== hashToken(oldToken)) {
    throw new Error('Refresh token mismatch');
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new Error('User not found');

  return issueTokens(user, context);
}

async function revokeRefreshToken(token) {
  try {
    const payload = verifyRefreshToken(token);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // swallow — logout should be idempotent
  }
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
