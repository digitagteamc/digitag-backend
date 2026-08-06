const { prisma } = require('../../config/db');
const otpService = require('../../services/otp/otp.service');
const tokenService = require('../../services/token/token.service');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const env = require('../../config/env');
const { ROLES } = require('../../constants/roles');
const admin = require('../../config/firebase');
const categoryService = require('../categories/category.service');
const razorpay = require('../../config/razorpay');
const logger = require('../../utils/logger');

/**
 * One phone number = one account. The User row's `role` field represents the
 * currently-active session role (Creator or Freelancer), not a one-time choice.
 * A single account can own both `creatorProfile` and `freelancerProfile` rows
 * and can freely switch between them via the /auth/switch-role endpoint.
 */

async function buildProfileMap(user) {
    if (!user) return { CREATOR: false, FREELANCER: false };
    const query = user.accountId
        ? { accountId: user.accountId }
        : { mobileNumber: user.mobileNumber };
    const allUsers = await prisma.user.findMany({
        where: query,
        include: { creatorProfile: true, freelancerProfile: true }
    });
    return {
        CREATOR: Boolean(allUsers.find(u => u.role === 'CREATOR' && u.creatorProfile && u.creatorProfile.name)),
        FREELANCER: Boolean(allUsers.find(u => u.role === 'FREELANCER' && u.freelancerProfile && u.freelancerProfile.name)),
    };
}

/**
 * Finds the User row for (accountId, role), or creates one — atomically
 * safe against two concurrent requests racing to create the same one (a
 * double-tap on login, a network retry hitting the server twice, etc).
 *
 * Previously each call site here did a plain find-then-create: load the
 * account's users, check if one matches the role, create one if not. Two
 * requests arriving milliseconds apart could both see "not found" and both
 * create a row — two real User rows for the same (account, role), one of
 * which silently never gets a profile attached to it. Login would then
 * non-deterministically resolve to either one on any given day, since
 * nothing ordered which duplicate `.find()`/`findFirst()` returned. That's
 * exactly what happened to several real accounts (incident: 2026-08-06) —
 * a completed profile with a same-role "ghost" duplicate sitting next to it,
 * silently swapped in on login with no warning.
 *
 * The fix: create() first, and if a concurrent request already won the race,
 * the partial unique index on (accountId, role) for non-deleted rows (see
 * migration 20260806100000_add_user_account_role_unique) turns the loser's
 * insert into a unique-constraint error (Prisma code P2002) instead of a
 * second row — caught here and re-fetches the winner instead of duplicating.
 */
async function findOrCreateRoleUser(accountId, role, createData) {
    const existing = await prisma.user.findFirst({
        where: { accountId, role, status: { not: 'DELETED' } },
        include: { creatorProfile: true, freelancerProfile: true },
    });
    if (existing) return { user: existing, isNewUser: false };

    try {
        const created = await prisma.user.create({
            data: { accountId, role, ...createData },
            include: { creatorProfile: true, freelancerProfile: true },
        });
        return { user: created, isNewUser: true };
    } catch (err) {
        if (err.code === 'P2002') {
            const winner = await prisma.user.findFirst({
                where: { accountId, role, status: { not: 'DELETED' } },
                include: { creatorProfile: true, freelancerProfile: true },
            });
            if (winner) return { user: winner, isNewUser: false };
        }
        throw err;
    }
}

async function initiateOtp({ mobileNumber, countryCode = '+91', role, categoryId }) {
    let account = await prisma.account.findUnique({
        where: { mobileNumber },
        include: { users: true }
    });

    let user = null;
    if (account && account.users.length > 0) {
        user = account.users.find(u => u.role === role) || account.users[0];
    } else {
        user = await prisma.user.findFirst({ where: { mobileNumber } });
    }

    if (user) {
        if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
            throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
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

    let account = await prisma.account.findUnique({
        where: { mobileNumber },
        include: { users: { include: { creatorProfile: true, freelancerProfile: true } } },
    });

    if (!account) {
        const legacyUser = await prisma.user.findFirst({
            where: { mobileNumber, accountId: null },
            include: { creatorProfile: true, freelancerProfile: true }
        });

        // upsert instead of create — two concurrent verify calls for the same
        // brand-new number (e.g. a slow response causing a retry while the
        // first request is still in flight) can both reach here having seen
        // no existing account. upsert makes the write atomic instead of
        // racing two creates against the unique Account.mobileNumber
        // constraint, whose loser previously surfaced as an uncaught 500.
        account = await prisma.account.upsert({
            where: { mobileNumber },
            create: { mobileNumber, countryCode },
            update: {},
        });

        if (legacyUser && !legacyUser.accountId) {
            await prisma.user.update({
                where: { id: legacyUser.id },
                data: { accountId: account.id }
            });
        }

        account = await prisma.account.findUnique({
            where: { id: account.id },
            include: { users: { include: { creatorProfile: true, freelancerProfile: true } } }
        });
    }

    const { user: foundOrCreated, isNewUser } = await findOrCreateRoleUser(account.id, role, {
        mobileNumber,
        countryCode,
        categoryId: categoryId || null,
        isVerified: true,
        lastLoginAt: new Date(),
    });
    const user = isNewUser ? foundOrCreated : await prisma.user.update({
        where: { id: foundOrCreated.id },
        data: {
            isVerified: true,
            lastLoginAt: new Date(),
            categoryId: categoryId || foundOrCreated.categoryId,
        },
        include: { creatorProfile: true, freelancerProfile: true },
    });

    const { accessToken, refreshToken } = await tokenService.issueTokens(user, context);
    const profiles = await buildProfileMap(user);

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

    const firebaseMobileNumber = decodedToken.phone_number;
    if (!firebaseMobileNumber) {
        throw ApiError.badRequest('Firebase token does not contain a phone number');
    }

    let number = firebaseMobileNumber;
    let countryCode = '+91';
    if (number.startsWith('+91')) {
        number = number.slice(3);
    }

    let account = await prisma.account.findUnique({
        where: { mobileNumber: number },
        include: { users: { include: { creatorProfile: true, freelancerProfile: true } } },
    });

    if (account) {
        const suspendedUser = account.users.find(u => u.status === 'SUSPENDED' || u.status === 'DELETED');
        if (suspendedUser) {
            throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
        }
    } else {
        const legacyUser = await prisma.user.findFirst({
            where: { mobileNumber: number, accountId: null },
            include: { creatorProfile: true, freelancerProfile: true }
        });

        if (legacyUser && (legacyUser.status === 'SUSPENDED' || legacyUser.status === 'DELETED')) {
            throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
        }

        // upsert instead of create — same race as completeOtp above.
        account = await prisma.account.upsert({
            where: { mobileNumber: number },
            create: { mobileNumber: number, countryCode },
            update: {},
        });

        if (legacyUser && !legacyUser.accountId) {
            await prisma.user.update({
                where: { id: legacyUser.id },
                data: { accountId: account.id }
            });
        }

        account = await prisma.account.findUnique({
            where: { id: account.id },
            include: { users: { include: { creatorProfile: true, freelancerProfile: true } } }
        });
    }

    const targetRole = role || ROLES.CREATOR;
    const { user: foundOrCreated, isNewUser } = await findOrCreateRoleUser(account.id, targetRole, {
        mobileNumber: number,
        countryCode,
        categoryId: categoryId || null,
        isVerified: true,
        lastLoginAt: new Date(),
    });
    const user = isNewUser ? foundOrCreated : await prisma.user.update({
        where: { id: foundOrCreated.id },
        data: {
            isVerified: true,
            lastLoginAt: new Date(),
            categoryId: categoryId || foundOrCreated.categoryId,
        },
        include: { creatorProfile: true, freelancerProfile: true },
    });

    const { accessToken, refreshToken } = await tokenService.issueTokens(user, context);
    const profiles = await buildProfileMap(user);

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
    const profiles = await buildProfileMap(user);
    return {
        ...sanitized,
        activeRole: user.role,
        profiles,
        availableRoles: Object.keys(profiles).filter((r) => profiles[r]),
    };
}

/**
 * Switch the active role on the account. Find or create a separate User row
 * for that role under the same Account, and issue tokens for it.
 */
async function switchRole(userId, role) {
    if (role !== ROLES.CREATOR && role !== ROLES.FREELANCER) {
        throw ApiError.badRequest('Role must be CREATOR or FREELANCER');
    }
    
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!currentUser) throw ApiError.notFound('User not found');
    
    let accountId = currentUser.accountId;
    if (!accountId) {
        // upsert instead of find-then-create — same race as completeOtp/
        // verifyFirebaseToken above.
        const account = await prisma.account.upsert({
            where: { mobileNumber: currentUser.mobileNumber },
            create: {
                mobileNumber: currentUser.mobileNumber,
                countryCode: currentUser.countryCode,
            },
            update: {},
        });
        accountId = account.id;
        await prisma.user.update({
            where: { id: userId },
            data: { accountId }
        });
    }

    const { user: foundOrCreated, isNewUser: targetIsNew } = await findOrCreateRoleUser(accountId, role, {
        mobileNumber: currentUser.mobileNumber,
        countryCode: currentUser.countryCode,
        isVerified: true,
        lastLoginAt: new Date(),
    });
    const targetUser = targetIsNew ? foundOrCreated : await prisma.user.update({
        where: { id: foundOrCreated.id },
        data: { lastLoginAt: new Date() },
        include: { creatorProfile: true, freelancerProfile: true }
    });

    const { accessToken, refreshToken } = await tokenService.issueTokens(targetUser);
    const profiles = await buildProfileMap(targetUser);

    return {
        user: sanitizeUser(targetUser),
        tokens: { accessToken, refreshToken },
        activeRole: targetUser.role,
        profiles,
        availableRoles: Object.keys(profiles).filter((r) => profiles[r]),
        isProfileCompleted: profiles[targetUser.role] === true,
    };
}

// Subscription states where Razorpay could still charge — must be cancelled
// at Razorpay before the account row is tombstoned, or billing outlives the account.
const BILLABLE_SUBSCRIPTION_STATES = new Set(['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED']);

/**
 * Deletes the user's account — soft-delete + anonymize the whole account and all profiles:
 */
async function deleteAccount(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            account: {
                include: {
                    users: {
                        include: {
                            subscription: true,
                            creatorProfile: { select: { tagId: true } },
                            freelancerProfile: { select: { tagId: true } },
                        }
                    }
                }
            },
            subscription: true,
            creatorProfile: { select: { tagId: true } },
            freelancerProfile: { select: { tagId: true } },
        },
    });
    if (!user) throw ApiError.notFound('Account not found');
    if (user.status === 'DELETED') return; // idempotent

    const profilesToDelete = user.account?.users || [user];
    
    for (const profile of profilesToDelete) {
        if (profile.subscription && BILLABLE_SUBSCRIPTION_STATES.has(profile.subscription.status)) {
            try {
                await razorpay.subscriptions.cancel(profile.subscription.razorpaySubscriptionId);
            } catch (err) {
                const desc = String(err?.error?.description || err?.message || '');
                if (!/not cancellable|already cancelled|completed|expired/i.test(desc)) {
                    logger.error('[deleteAccount] Razorpay cancel failed', { userId: profile.id, err: desc });
                    throw ApiError.internal('Could not cancel your subscription. Please try again or contact support.');
                }
            }
            await prisma.subscription.update({ where: { userId: profile.id }, data: { status: 'CANCELLED' } });
        }
    }

    const stamp = Date.now();
    const tombstone = (value) => `deleted:${stamp}:${value}`;

    const transactionQueries = [];
    
    if (user.accountId) {
        transactionQueries.push(
            prisma.account.update({
                where: { id: user.accountId },
                data: {
                    mobileNumber: tombstone(user.mobileNumber),
                }
            })
        );
    }

    for (const profile of profilesToDelete) {
        transactionQueries.push(
            prisma.user.update({
                where: { id: profile.id },
                data: {
                    status: 'DELETED',
                    mobileNumber: tombstone(profile.mobileNumber),
                    fcmToken: null,
                    isPremium: false,
                },
            }),
            ...(profile.creatorProfile?.tagId
                ? [prisma.creatorProfile.update({ where: { userId: profile.id }, data: { tagId: tombstone(profile.creatorProfile.tagId) } })]
                : []),
            ...(profile.freelancerProfile?.tagId
                ? [prisma.freelancerProfile.update({ where: { userId: profile.id }, data: { tagId: tombstone(profile.freelancerProfile.tagId) } })]
                : []),
            prisma.refreshToken.updateMany({ where: { userId: profile.id, revokedAt: null }, data: { revokedAt: new Date() } }),
            prisma.fcmDevice.deleteMany({ where: { userId: profile.id } }),
            prisma.post.updateMany({ where: { userId: profile.id }, data: { isActive: false } }),
            prisma.follow.deleteMany({ where: { OR: [{ followerId: profile.id }, { followingId: profile.id }] } }),
            prisma.block.deleteMany({ where: { OR: [{ blockerId: profile.id }, { blockedId: profile.id }] } }),
            prisma.savedPost.deleteMany({ where: { userId: profile.id } }),
            prisma.notification.deleteMany({ where: { userId: profile.id } }),
            prisma.socialVerification.deleteMany({ where: { userId: profile.id } }),
            prisma.instagramVerification.deleteMany({ where: { userId: profile.id } }),
        );
    }

    await prisma.$transaction(transactionQueries);
}

async function getProfiles(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountId: true, mobileNumber: true }
    });
    if (!user) throw ApiError.notFound('User not found');

    const query = user.accountId ? { accountId: user.accountId } : { mobileNumber: user.mobileNumber };
    const users = await prisma.user.findMany({
        where: query,
        include: {
            creatorProfile: { select: { name: true, profilePicture: true } },
            freelancerProfile: { select: { name: true, profilePicture: true } }
        }
    });

    return users.map(u => ({
        id: u.id,
        role: u.role,
        name: u.role === 'CREATOR' ? u.creatorProfile?.name : u.freelancerProfile?.name,
        profilePicture: u.role === 'CREATOR' ? u.creatorProfile?.profilePicture : u.freelancerProfile?.profilePicture,
        isProfileCompleted: u.isProfileCompleted,
    }));
}

async function selectProfile(userId, targetProfileId) {
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountId: true, mobileNumber: true }
    });
    if (!currentUser) throw ApiError.notFound('User not found');

    const targetUser = await prisma.user.findUnique({
        where: { id: targetProfileId },
        include: { creatorProfile: true, freelancerProfile: true }
    });
    if (!targetUser) throw ApiError.notFound('Profile not found');

    const isSameAccount = currentUser.accountId
        ? targetUser.accountId === currentUser.accountId
        : targetUser.mobileNumber === currentUser.mobileNumber;

    if (!isSameAccount) {
        throw ApiError.forbidden('Profile does not belong to this account');
    }

    const { accessToken, refreshToken } = await tokenService.issueTokens(targetUser);
    const profiles = await buildProfileMap(targetUser);

    return {
        user: sanitizeUser(targetUser),
        tokens: { accessToken, refreshToken },
        activeRole: targetUser.role,
        profiles,
        availableRoles: Object.keys(profiles).filter((r) => profiles[r]),
        isProfileCompleted: profiles[targetUser.role] === true,
    };
}

function sanitizeUser(user) {
    if (!user) return null;
    const { id, mobileNumber, countryCode, role, categoryId, isVerified, isProfileCompleted, isPremium, status, createdAt, creatorProfile, freelancerProfile } = user;
    return { id, mobileNumber, countryCode, role, categoryId, isVerified, isProfileCompleted, isPremium, status, createdAt, creatorProfile, freelancerProfile };
}

module.exports = { initiateOtp, completeOtp, verifyFirebaseToken, refreshTokens, logout, getMe, switchRole, deleteAccount, getProfiles, selectProfile };
