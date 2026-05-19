const env = require('../../config/env');
const logger = require('../../utils/logger');
const { prisma } = require('../../config/db');
const { generateNumericOtp, hashOtp, compareOtp } = require('../../utils/generateOtp');
const MESSAGES = require('../../constants/messages');
const { ApiError } = require('../../utils/apiResponse');

const MockOtpProvider = require('./mockOtp.provider');
const Msg91OtpProvider = require('./msg91Otp.provider');

function resolveProvider() {
    switch ((env.OTP_PROVIDER || 'mock').toLowerCase()) {
        case 'msg91':
            return new Msg91OtpProvider();
        case 'mock':
        default:
            return new MockOtpProvider();
    }
}

const provider = resolveProvider();

// Test phone numbers — bypass real OTP for internal testing.
// Format: { 'MOBILE_NUMBER': 'FIXED_OTP_CODE' }
const TEST_NUMBERS = env.TEST_PHONE_NUMBERS
    ? Object.fromEntries(env.TEST_PHONE_NUMBERS.split(',').map(e => e.trim().split(':')))
    : {};

async function sendOtp({ mobileNumber, countryCode = '+91', userId = null, purpose = 'LOGIN' }) {
    const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
    const cooldownAgo = new Date(Date.now() - cooldownMs);
    const recent = await prisma.otp.findFirst({
        where: { mobileNumber, createdAt: { gt: cooldownAgo } },
        orderBy: { createdAt: 'desc' },
    });
    if (recent) {
        const waitMs = recent.createdAt.getTime() + cooldownMs - Date.now();
        const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
        throw ApiError.tooMany(
            `${MESSAGES.AUTH.OTP_RESEND_COOLDOWN} Try again in ${retryAfterSeconds}s.`,
            { retryAfterSeconds },
        );
    }

    const isTestNumber = Object.prototype.hasOwnProperty.call(TEST_NUMBERS, mobileNumber);
    const code = isTestNumber ? TEST_NUMBERS[mobileNumber] : generateNumericOtp(env.OTP_LENGTH);
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate previous unused OTPs for this number/purpose.
    await prisma.otp.updateMany({
        where: { mobileNumber, purpose, isUsed: false, expiresAt: { gt: new Date() } },
        data: { isUsed: true },
    });

    const record = await prisma.otp.create({
        data: { userId, mobileNumber, codeHash, purpose, expiresAt },
    });

    if (!isTestNumber) {
        try {
            await provider.send({ mobileNumber, countryCode, code, purpose });
        } catch (err) {
            logger.error('OTP delivery failed', { err });
            throw ApiError.internal('Failed to deliver OTP');
        }
    } else {
        logger.info('[OTP] Test number — skipping SMS delivery', { mobileNumber });
    }

    return {
        otpId: record.id,
        expiresAt,
        devCode: env.isProduction ? undefined : code,
    };
}

async function verifyOtp({ mobileNumber, code, purpose = 'LOGIN' }) {
    const record = await prisma.otp.findFirst({
        where: { mobileNumber, purpose, isUsed: false },
        orderBy: { createdAt: 'desc' },
    });

    if (!record) throw ApiError.badRequest(MESSAGES.AUTH.OTP_INVALID);
    if (record.expiresAt < new Date()) throw ApiError.badRequest(MESSAGES.AUTH.OTP_EXPIRED);
    if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
        await prisma.otp.update({ where: { id: record.id }, data: { isUsed: true } });
        throw ApiError.tooMany(MESSAGES.AUTH.OTP_MAX_ATTEMPTS);
    }

    const ok = compareOtp(code, record.codeHash);
    if (!ok) {
        const updated = await prisma.otp.update({
            where: { id: record.id },
            data: { attempts: { increment: 1 } },
        });
        const attemptsRemaining = Math.max(0, env.OTP_MAX_ATTEMPTS - updated.attempts);
        if (attemptsRemaining <= 0) {
            await prisma.otp.update({ where: { id: record.id }, data: { isUsed: true } });
            throw ApiError.tooMany(MESSAGES.AUTH.OTP_MAX_ATTEMPTS, { attemptsRemaining: 0 });
        }
        throw ApiError.badRequest(
            `Invalid OTP. ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.`,
            { attemptsRemaining },
        );
    }

    await prisma.otp.update({ where: { id: record.id }, data: { isUsed: true } });
    return { verified: true };
}

module.exports = { sendOtp, verifyOtp };