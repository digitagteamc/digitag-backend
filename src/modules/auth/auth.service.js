const { prisma } = require('../../config/db');
const otpService = require('../../services/otp/otp.service');
const tokenService = require('../../services/token/token.service');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const env = require('../../config/env');
const { ROLES } = require('../../constants/roles');
const admin = require('../../config/firebase');
const categoryService = require('../categories/category.service');

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
        // Keep original role — one phone number = one role forever
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
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

async function verifyFirebaseToken({ idToken, role, categoryId, context = {} }) {
    if (!admin.apps.length) {
        throw ApiError.internal('Firebase Admin is not configured');
    }
    
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        console.error('[verifyFirebaseToken] Firebase verifyIdToken failed:', error.code, error.message);
        throw ApiError.unauthorized('Invalid Firebase token');
    }

    const mobileNumber = decodedToken.phone_number;
    if (!mobileNumber) {
        throw ApiError.badRequest('Firebase token does not contain a phone number');
    }

    // Format phone number to match the app's structure (Firebase uses E.164, e.g., +919876543210)
    // We strip the country code +91 for searching if your DB stores it separately or together.
    // The previous completeOtp uses mobileNumber and countryCode='+91'. 
    // Assuming mobileNumber in DB is without '+91' or whatever country code, we need to handle it.
    let number = mobileNumber;
    let countryCode = '+91';
    if (number.startsWith('+91')) {
        number = number.slice(3);
    }

    let user = await prisma.user.findUnique({
        where: { mobileNumber: number },
        include: { creatorProfile: true, freelancerProfile: true },
    });
    let isNewUser = false;

    if (!user) {
        user = await prisma.user.create({
            data: {
                mobileNumber: number,
                countryCode,
                role: role || ROLES.CREATOR,
                categoryId: categoryId || null,
                isVerified: true,
                lastLoginAt: new Date(),
            },
            include: { creatorProfile: true, freelancerProfile: true },
        });
        isNewUser = true;
    } else {
        // Keep original role — one phone number = one role forever
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
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
            creatorProfile: { include: { category: { select: { id: true, name: true, slug: true } } } },
            freelancerProfile: { include: { category: { select: { id: true, name: true, slug: true } } } },
        },
    });
    if (!user) throw ApiError.notFound();

    // Profiles store `categories` as raw Category-table UUIDs — resolve them to
    // slugs/names so the app can actually display them instead of raw ids.
    const categoryMap = await categoryService.resolveCategoryMap([
        ...(user.creatorProfile?.categories || []),
        ...(user.freelancerProfile?.categories || []),
    ]);
    const attachResolvedCategories = (profile) => {
        if (!profile) return profile;
        const resolved = (profile.categories || []).map((id) => categoryMap.get(id)).filter(Boolean);
        return { ...profile, categorySlugs: resolved.map((c) => c.slug), categoryNames: resolved.map((c) => c.name) };
    };
    user.creatorProfile = attachResolvedCategories(user.creatorProfile);
    user.freelancerProfile = attachResolvedCategories(user.freelancerProfile);

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

/**
 * Permanently deletes the user's account and all associated data.
 * Cascades via Prisma schema relations (posts, messages, profiles, tokens).
 * Google Play requires self-service account deletion — this powers that button.
 */
async function deleteAccount(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('Account not found');

    // Soft-delete first so in-flight sessions get a clear error, then hard-delete
    await prisma.user.update({ where: { id: userId }, data: { status: 'DELETED' } });

    // Revoke all refresh tokens so existing sessions can't be used
    await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });

    // Hard delete — Prisma cascade handles profiles, posts, messages, collaborations
    await prisma.user.delete({ where: { id: userId } });
}

function sanitizeUser(user) {
    if (!user) return null;
    const { id, mobileNumber, countryCode, role, categoryId, isVerified, isProfileCompleted, isPremium, status, createdAt, creatorProfile, freelancerProfile } = user;
    return { id, mobileNumber, countryCode, role, categoryId, isVerified, isProfileCompleted, isPremium, status, createdAt, creatorProfile, freelancerProfile };
}

module.exports = { initiateOtp, completeOtp, verifyFirebaseToken, refreshTokens, logout, getMe, switchRole, deleteAccount };
