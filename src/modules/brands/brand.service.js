const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const { ROLES } = require('../../constants/roles');
const userService = require('../users/user.service');
const { generateTagId } = require('../../utils/generateTagId');
const { ensureUserTag } = require('../../utils/generateUserTag');

// Not built on buildProfileService (src/modules/_shared/profileService.js):
// that factory's getMyProfile/getProfileById always `include: { category }`,
// which BrandProfile has no relation for (Prisma throws on an include for a
// non-existent relation), and its updateProfile cross-syncs shared fields
// into a CREATOR/FREELANCER sibling profile — a concept that doesn't apply
// to Brand. This mirrors the same create/update/get shape without either.

async function ensureBrandUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== ROLES.BRAND) throw ApiError.forbidden(MESSAGES.PROFILE.ROLE_MISMATCH);
  return user;
}

async function ensureEmailAvailable(userId, email, accountId) {
  if (!email) return;
  const existing = await prisma.brandProfile.findFirst({
    where: {
      email,
      NOT: accountId ? { user: { accountId } } : { userId },
    },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict(MESSAGES.PROFILE.EMAIL_IN_USE);
}

async function createProfile(userId, data) {
  const user = await ensureBrandUser(userId);

  const existing = await prisma.brandProfile.findUnique({ where: { userId } });
  if (existing) throw ApiError.conflict(MESSAGES.PROFILE.ALREADY_EXISTS);

  if (data.email) await ensureEmailAvailable(userId, data.email, user.accountId);

  const tagId = await generateTagId({ role: ROLES.BRAND, model: 'brandProfile' });

  // approvalStatus always starts PENDING (schema default) regardless of how
  // complete this submission is — completion and admin approval are
  // separate gates (see Phase 0 plan item 7 for the posting/collab check).
  const profile = await prisma.brandProfile.create({ data: { ...data, userId, tagId } });

  await ensureUserTag({ userId, role: ROLES.BRAND, location: data.city, language: null }).catch(() => {});

  await userService.recomputeProfileCompletion(userId);
  return profile;
}

async function updateProfile(userId, data) {
  const user = await ensureBrandUser(userId);

  const existing = await prisma.brandProfile.findUnique({ where: { userId } });
  if (!existing) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);

  if (data.email) await ensureEmailAvailable(userId, data.email, user.accountId);

  const profile = await prisma.brandProfile.update({ where: { userId }, data });

  await userService.recomputeProfileCompletion(userId);
  return profile;
}

async function getMyProfile(userId) {
  await ensureBrandUser(userId);
  const profile = await prisma.brandProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
  return profile;
}

async function getProfileById(id) {
  const profile = await prisma.brandProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true, role: true, status: true, createdAt: true } } },
  });
  if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
  return profile;
}

// GET /brands/me/status — what pending.tsx polls to replace its current
// fake isProfileCompleted-derived status with the real approval state.
async function getMyStatus(userId) {
  await ensureBrandUser(userId);
  const profile = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { approvalStatus: true, rejectionReason: true },
  });
  if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
  return profile;
}

// Call-site guard for post/collaboration creation (post.service.js,
// collaboration.service.js) — a no-op for every other role, so it's safe to
// call unconditionally at the top of those create paths. A brand with no
// profile yet is treated the same as PENDING (blocked), not a separate error,
// since "no profile" and "not yet approved" both mean the same thing here:
// not cleared to post/collaborate yet.
async function assertBrandApproved(userId, role) {
  if (role !== ROLES.BRAND) return;
  const profile = await prisma.brandProfile.findUnique({ where: { userId }, select: { approvalStatus: true } });
  if (!profile || profile.approvalStatus !== 'APPROVED') {
    throw ApiError.forbidden('Your brand profile is still pending admin approval.');
  }
}

module.exports = { createProfile, updateProfile, getMyProfile, getProfileById, getMyStatus, assertBrandApproved };
