const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ROLES } = require('../../constants/roles');

async function getUserById(id) {
  const [user, followerCount, followingCount, collabCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
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
  return { ...user, followerCount, followingCount, collabCount };
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

module.exports = { getUserById, getUserStats, recomputeProfileCompletion, getOnboardingStatus };
