const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const userService = require('../users/user.service');

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

  async function ensureEmailAvailable(userId, email) {
    if (!email) return;
    const existing = await delegate().findFirst({
      where: { email, NOT: { userId } },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict(MESSAGES.PROFILE.EMAIL_IN_USE);
  }

  async function createProfile(userId, data) {
    await ensureUserRole(userId);

    const existing = await delegate().findUnique({ where: { userId } });
    if (existing) throw ApiError.conflict(MESSAGES.PROFILE.ALREADY_EXISTS);

    if (data.email) await ensureEmailAvailable(userId, data.email);

    const profile = await delegate().create({ data: { ...data, userId } });

    await userService.recomputeProfileCompletion(userId);
    return profile;
  }

  async function updateProfile(userId, data) {
    await ensureUserRole(userId);

    const existing = await delegate().findUnique({ where: { userId } });
    if (!existing) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);

    if (data.email) await ensureEmailAvailable(userId, data.email);

    const profile = await delegate().update({ where: { userId }, data });

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
    return profile;
  }

  async function getProfileById(id) {
    const profile = await delegate().findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, role: true, status: true, createdAt: true } },
      },
    });
    if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
    return profile;
  }

  return { createProfile, updateProfile, getMyProfile, getProfileById };
}

module.exports = { buildProfileService };
