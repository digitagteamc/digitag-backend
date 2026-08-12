const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const userService = require('../users/user.service');
const { generateTagId } = require('../../utils/generateTagId');
const { ensureUserTag } = require('../../utils/generateUserTag');

async function attachInstagramAccounts(profile) {
  const instagramAccounts = await prisma.instagramVerification.findMany({
    where: { userId: profile.userId, status: 'VERIFIED' },
    select: { id: true, instagramUsername: true, followers: true, verifiedAt: true },
    orderBy: { verifiedAt: 'asc' },
  });
  return { ...profile, instagramAccounts };
}

/**
 * Factory that produces a role-specific profile service.
 * @param {Object} opts
 * @param {'creatorProfile'|'freelancerProfile'} opts.model - Prisma model delegate name.
 * @param {string} opts.role - UserRole enum (CREATOR | FREELANCER).
 */
function buildProfileService({ model, role }) {
  function delegate() {
    return prisma[model];
  }

  async function ensureUserRole(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    if (user.role !== role) throw ApiError.forbidden(MESSAGES.PROFILE.ROLE_MISMATCH);
    return user;
  }

  // Block if this email is already used under a genuinely different account
  // (different phone number) — but a sibling role-profile of the SAME account
  // (same person, switched roles via the multi-profile feature) isn't
  // "another" user, so exclude the whole account's users, not just this one
  // row, when we know the account. Same pattern as Instagram/YouTube/Facebook
  // verification.
  async function ensureEmailAvailable(userId, email, accountId) {
    if (!email) return;
    const existing = await delegate().findFirst({
      where: {
        email,
        NOT: accountId ? { user: { accountId } } : { userId },
      },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict(MESSAGES.PROFILE.EMAIL_IN_USE);
  }

  async function createProfile(userId, data) {
    const user = await ensureUserRole(userId);

    const existing = await delegate().findUnique({ where: { userId } });
    if (existing) throw ApiError.conflict(MESSAGES.PROFILE.ALREADY_EXISTS);

    if (data.email) await ensureEmailAvailable(userId, data.email, user.accountId);

    const tagId = await generateTagId({ role, model });

    const profile = await delegate().create({ data: { ...data, userId, tagId } });

    // Admin-only internal tag — never surfaced to the app, so a failure here
    // must not break signup for the user.
    await ensureUserTag({ userId, role, location: data.location, language: data.language }).catch(() => {});

    await userService.recomputeProfileCompletion(userId);
    return profile;
  }

  async function updateProfile(userId, data) {
    const user = await ensureUserRole(userId);

    const existing = await delegate().findUnique({ where: { userId } });
    if (!existing) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);

    if (data.email) await ensureEmailAvailable(userId, data.email, user.accountId);

    const profile = await delegate().update({ where: { userId }, data });

    // Shared identity fields apply to the person, not the role — keep the other
    // role's profile (if any) in sync so switching roles doesn't show stale info.
    const otherModel = model === 'creatorProfile' ? 'freelancerProfile' : 'creatorProfile';
    const sharedFields = ['name', 'email', 'profilePicture', 'profilePictureKey'];
    const sharedUpdate = {};
    for (const field of sharedFields) {
      if (data[field] !== undefined) sharedUpdate[field] = data[field];
    }
    if (Object.keys(sharedUpdate).length > 0 && user.accountId) {
      // The other role lives on a *different* User row under the same
      // Account (that's the whole point of the multi-profile feature) — the
      // sibling profile's userId is that other row's id, never this one, so
      // it has to be looked up via accountId first.
      const otherRole = role === 'CREATOR' ? 'FREELANCER' : 'CREATOR';
      const otherUser = await prisma.user.findFirst({
        where: { accountId: user.accountId, role: otherRole, status: { not: 'DELETED' } },
        select: { id: true },
      });
      if (otherUser) {
        const otherProfile = await prisma[otherModel].findUnique({ where: { userId: otherUser.id } });
        if (otherProfile) {
          try {
            await prisma[otherModel].update({ where: { userId: otherUser.id }, data: sharedUpdate });
          } catch {
            // Likely an email unique-constraint clash with a different user's row in
            // the other role's table — don't let a cosmetic sync failure break the
            // primary profile update that the user is actually waiting on.
          }
        }
      }
    }

    await userService.recomputeProfileCompletion(userId);
    return profile;
  }

  async function getMyProfile(userId) {
    await ensureUserRole(userId);
    const profile = await delegate().findUnique({
      where: { userId },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
    return attachInstagramAccounts(profile);
  }

  async function getProfileById(id) {
    const profile = await delegate().findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, role: true, status: true, createdAt: true } },
      },
    });
    // A deleted/suspended user's profile must 404 for everyone else, same as
    // their posts (post.service.js) and their main profile view (user.service.js).
    if (!profile || profile.user?.status !== 'ACTIVE') throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
    return attachInstagramAccounts(profile);
  }

  return { createProfile, updateProfile, getMyProfile, getProfileById };
}

module.exports = { buildProfileService };
