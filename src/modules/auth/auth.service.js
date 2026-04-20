const { prisma } = require('../../config/db');
const otpService = require('../../services/otp/otp.service');
const tokenService = require('../../services/token/token.service');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const env = require('../../config/env');
const { ROLES } = require('../../constants/roles');

/**
 * One phone number = one account. The User row's `role` field represents the
 * currently-active session role (Creator or Freelancer), not a one-time choice.
 * A single account can own both `creatorProfile` and `freelancerProfile` rows
 * and can freely switch between them via the /auth/switch-role endpoint.
 */

function buildProfileMap(user) {
    return {
        CREATOR: Boolean(user?.creatorProfile && user.creatorProfile.name),
        FREELANCER: Boolean(user?.freelancerProfile && user.freelancerProfile.name),
    };
}

async function initiateOtp({ mobileNumber, countryCode = '+91', role, categoryId }) {
    let user = await prisma.user.findUnique({ where: { mobileNumber } });

    if (user) {
        if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
            throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_SUSPENDED);
        }
        // NOTE: we intentionally no longer reject when the stored `role` differs
        // from the requested one. The role parameter is an intent for the
        // current session — it is applied on successful verify.
        if (categoryId && user.categoryId !== categoryId) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { categoryId },
            });
        }
    }

    const result = await otpService.sendOtp({
        mobileNumber,
        countryCode,
        userId: user ? user.id : null,
        purpose: 'LOGIN',
    });

    return {
        otpId: result.otpId,
        expiresAt: result.expiresAt,
        // Seconds the UI should keep the resend button disabled.
        resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
        // How long the code is valid for — UI can show an expiry countdown.
        expirySeconds: env.OTP_EXPIRY_MINUTES * 60,
        codeLength: env.OTP_LENGTH,
        isNewUser: !user,
        devCode: result.devCode,
    };
}

async function completeOtp({
    mobileNumber,
    countryCode = '+91',
    code,
    role,
    categoryId,
    context = {},
}) {
    await otpService.verifyOtp({ mobileNumber, code, purpose: 'LOGIN' });

    let user = await prisma.user.findUnique({
        where: { mobileNumber },
        include: { creatorProfile: true, freelancerProfile: true },
    });
    let isNewUser = false;

    if (!user) {
        user = await prisma.user.create({
            data: {
                mobileNumber,
                countryCode,
                role,
                categoryId: categoryId || null,
                isVerified: true,
                lastLoginAt: new Date(),
            },
            include: { creatorProfile: true, freelancerProfile: true },
        });
        isNewUser = true;
    } else {
        // Set the active session role to whatever was requested — no rejection
        // on role mismatch. The same phone number can freely use either role.
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                role,
                isVerified: true,
                lastLoginAt: new Date(),
                categoryId: categoryId || user.categoryId,
            },
            include: { creatorProfile: true, freelancerProfile: true },
        });
    }

    const { accessToken, refreshToken } = await tokenService.issueTokens(user, context);
    const profiles = buildProfileMap(user);

    return {
        user: sanitizeUser(user),
        tokens: { accessToken, refreshToken },
        isNewUser,
        activeRole: user.role,
        profiles,
        availableRoles: Object.keys(profiles).filter((r) => profiles[r]),
        // Convenience: true when the current active role has a complete profile.
        isProfileCompleted: profiles[user.role] === true,
    };
}

async function refreshTokens(refreshToken, context = {}) {
    try {
        return await tokenService.rotateRefreshToken(refreshToken, context);
    } catch {
        throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);
    }
}

async function logout(refreshToken) {
    if (refreshToken) await tokenService.revokeRefreshToken(refreshToken);
}

async function getMe(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            category: { select: { id: true, name: true, slug: true } },
            creatorProfile: true,
            freelancerProfile: true,
        },
    });
    if (!user) throw ApiError.notFound();
    const sanitized = sanitizeUser(user);
    const profiles = buildProfileMap(user);
    return {
        ...sanitized,
        activeRole: user.role,
        profiles,
        availableRoles: Object.keys(profiles).filter((r) => profiles[r]),
    };
}

/**
 * Switch the active role on the account. Does NOT require the target role
 * profile to exist — the UI can route to the signup form afterwards if the
 * profile still needs to be filled. Returns the fresh profile map and a flag
 * indicating whether the newly-active role already has a complete profile.
 */
async function switchRole(userId, role) {
    if (role !== ROLES.CREATOR && role !== ROLES.FREELANCER) {
        throw ApiError.badRequest('Role must be CREATOR or FREELANCER');
    }
    const user = await prisma.user.update({
        where: { id: userId },
        data: { role },
        include: { creatorProfile: true, freelancerProfile: true },
    });
    const profiles = buildProfileMap(user);
    return {
        user: sanitizeUser(user),
        activeRole: user.role,
        profiles,
        availableRoles: Object.keys(profiles).filter((r) => profiles[r]),
        isProfileCompleted: profiles[user.role] === true,
    };
}

function sanitizeUser(user) {
    if (!user) return null;
    const { ...rest } = user;
    return rest;
}

module.exports = { initiateOtp, completeOtp, refreshTokens, logout, getMe, switchRole };
