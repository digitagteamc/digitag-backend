const env = require('../../config/env');
const logger = require('../../utils/logger');
const { prisma } = require('../../config/db');
const { generateNumericOtp, hashOtp, compareOtp } = require('../../utils/generateOtp');
const { ApiError } = require('../../utils/apiResponse');

const MockEmailProvider = require('./mockEmail.provider');
const SesEmailProvider = require('./sesEmail.provider');
const ResendEmailProvider = require('./resendEmail.provider');

function resolveProvider() {
  switch ((env.EMAIL_PROVIDER || 'mock').toLowerCase()) {
    case 'resend':
      return new ResendEmailProvider();
    case 'ses':
      return new SesEmailProvider();
    case 'mock':
    default:
      return new MockEmailProvider();
  }
}

const provider = resolveProvider();

async function startEmailVerification(userId, email) {
  const cooldownMs = env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000;
  const cooldownAgo = new Date(Date.now() - cooldownMs);
  const recent = await prisma.emailVerification.findFirst({
    where: { userId, email, createdAt: { gt: cooldownAgo } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const waitMs = recent.createdAt.getTime() + cooldownMs - Date.now();
    const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
    throw ApiError.tooMany(
      `Please wait before requesting another code. Try again in ${retryAfterSeconds}s.`,
      { retryAfterSeconds },
    );
  }

  const code = generateNumericOtp(env.EMAIL_OTP_LENGTH);
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + env.EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any previous pending codes for this exact (user, email) pair.
  await prisma.emailVerification.updateMany({
    where: { userId, email, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });

  const record = await prisma.emailVerification.create({
    data: { userId, email, codeHash, expiresAt },
  });

  try {
    await provider.send({ to: email, code, expiryMinutes: env.EMAIL_OTP_EXPIRY_MINUTES });
  } catch (err) {
    logger.error('Email OTP delivery failed', { err });
    throw ApiError.internal('Failed to send verification email. Please try again.');
  }

  return {
    id: record.id,
    email,
    expiresAt,
    devCode: env.isProduction ? undefined : code,
  };
}

async function verifyEmailCode(userId, id, code) {
  const record = await prisma.emailVerification.findFirst({ where: { id, userId } });

  if (!record) throw ApiError.notFound('Verification not found');
  if (record.status === 'VERIFIED') return { verified: true, email: record.email };
  if (record.expiresAt < new Date()) {
    if (record.status === 'PENDING') {
      await prisma.emailVerification.update({ where: { id }, data: { status: 'EXPIRED' } });
    }
    throw ApiError.badRequest('Code expired. Request a new one.');
  }
  if (record.status !== 'PENDING') {
    throw ApiError.badRequest('This code is no longer valid. Request a new one.');
  }
  if (record.attempts >= env.EMAIL_OTP_MAX_ATTEMPTS) {
    await prisma.emailVerification.update({ where: { id }, data: { status: 'FAILED' } });
    throw ApiError.tooMany('Too many invalid attempts. Request a new code.');
  }

  const ok = compareOtp(code, record.codeHash);
  if (!ok) {
    const updated = await prisma.emailVerification.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
    const attemptsRemaining = Math.max(0, env.EMAIL_OTP_MAX_ATTEMPTS - updated.attempts);
    if (attemptsRemaining <= 0) {
      await prisma.emailVerification.update({ where: { id }, data: { status: 'FAILED' } });
      throw ApiError.tooMany('Too many invalid attempts. Request a new code.');
    }
    throw ApiError.badRequest(
      `Incorrect code. ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      { attemptsRemaining },
    );
  }

  await prisma.emailVerification.update({
    where: { id },
    data: { status: 'VERIFIED', verifiedAt: new Date() },
  });
  return { verified: true, email: record.email };
}

/** Used by the creator/freelancer profile services at submit time — is
 *  there a currently-VERIFIED EmailVerification row for this (userId, email)? */
async function isEmailVerifiedForUser(userId, email) {
  const record = await prisma.emailVerification.findFirst({
    where: { userId, email, status: 'VERIFIED' },
    orderBy: { verifiedAt: 'desc' },
  });
  return Boolean(record);
}

module.exports = { startEmailVerification, verifyEmailCode, isEmailVerifiedForUser };
