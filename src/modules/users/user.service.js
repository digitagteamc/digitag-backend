const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ROLES } = require('../../constants/roles');
const categoryService = require('../categories/category.service');

async function getUserIdByTag(tagId) {
  const [creator, freelancer] = await Promise.all([
    prisma.creatorProfile.findFirst({ where: { tagId: { equals: tagId, mode: 'insensitive' } }, select: { userId: true } }),
    prisma.freelancerProfile.findFirst({ where: { tagId: { equals: tagId, mode: 'insensitive' } }, select: { userId: true } }),
  ]);
  const match = creator || freelancer;
  if (!match) throw ApiError.notFound('Profile not found');
  return { userId: match.userId };
}

async function getUserById(id) {
  const [user, followerCount, followingCount, collabCount] = await Promise.all([
    // This endpoint is publicly browsable (no auth required) — select only
    // profile-facing fields, never mobileNumber/fcmToken/status/etc.
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        createdAt: true,
        isPremium: true,
        category: { select: { id: true, name: true, slug: true } },
        creatorProfile: true,
        freelancerProfile: true,
      },
    }),
    prisma.follow.count({ where: { followingId: id } }),
    prisma.follow.count({ where: { followerId: id } }),
    prisma.collaboration.count({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: id }, { receiverId: id }],
      },
    }),
  ]);
  if (!user) throw ApiError.notFound('User not found');

  // Profiles store `categories` as raw Category-table UUIDs — resolve them to
  // slugs/names so the app can display them instead of raw ids.
  const categoryMap = await categoryService.resolveCategoryMap([
    ...(user.creatorProfile?.categories || []),
    ...(user.freelancerProfile?.categories || []),
  ]);
  const attachResolvedCategories = (profile) => {
    if (!profile) return profile;
    const resolved = (profile.categories || []).map((cid) => categoryMap.get(cid)).filter(Boolean);
    return { ...profile, categorySlugs: resolved.map((c) => c.slug), categoryNames: resolved.map((c) => c.name) };
  };

  return {
    ...user,
    creatorProfile: attachResolvedCategories(user.creatorProfile),
    freelancerProfile: attachResolvedCategories(user.freelancerProfile),
    followerCount,
    followingCount,
    collabCount,
  };
}

async function recomputeProfileCompletion(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { creatorProfile: true, freelancerProfile: true },
  });
  if (!user) return false;

  const profile = user.role === ROLES.CREATOR ? user.creatorProfile : user.freelancerProfile;
  // A profile counts as complete once the user has given a name. Category is
  // optional at signup; selectors can populate it later without re-gating the UX.
  const isCompleted = Boolean(profile && profile.name);

  if (user.isProfileCompleted !== isCompleted) {
    await prisma.user.update({
      where: { id: userId },
      data: { isProfileCompleted: isCompleted },
    });
  }
  return isCompleted;
}

async function getOnboardingStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isVerified: true,
      isProfileCompleted: true,
      categoryId: true,
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function getUserStats(id) {
  const [user, followerCount, followingCount, collabCount] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true } }),
    prisma.follow.count({ where: { followingId: id } }),
    prisma.follow.count({ where: { followerId: id } }),
    prisma.collaboration.count({
      where: { status: 'ACCEPTED', OR: [{ senderId: id }, { receiverId: id }] },
    }),
  ]);
  if (!user) throw ApiError.notFound('User not found');
  return { followerCount, followingCount, collabCount };
}

module.exports = { getUserById, getUserIdByTag, getUserStats, recomputeProfileCompletion, getOnboardingStatus };
