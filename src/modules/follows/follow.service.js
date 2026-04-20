const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { OPPOSITE_FEED_ROLE } = require('../../constants/roles');

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    creatorProfile: { select: { name: true, profilePicture: true, location: true, bio: true } },
    freelancerProfile: { select: { name: true, profilePicture: true, location: true, bio: true } },
  },
};

function shapeUser(u) {
  if (!u) return null;
  const profile = u.creatorProfile || u.freelancerProfile;
  return {
    id: u.id,
    role: u.role,
    name: profile ? profile.name : null,
    profilePicture: profile ? profile.profilePicture : null,
    location: profile ? profile.location : null,
    bio: profile ? profile.bio : null,
  };
}

async function follow(followerId, followingId) {
  if (followerId === followingId) throw ApiError.badRequest('Cannot follow yourself');
  const other = await prisma.user.findUnique({ where: { id: followingId } });
  if (!other) throw ApiError.notFound('User not found');

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  if (existing) return existing;

  return prisma.follow.create({ data: { followerId, followingId } });
}

async function unfollow(followerId, followingId) {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  return { unfollowed: true };
}

async function listFollowing(userId) {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    include: { following: userInclude },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => shapeUser(r.following));
}

async function listFollowers(userId) {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId },
    include: { follower: userInclude },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => shapeUser(r.follower));
}

async function listSuggestions(userId, { limit = 20 } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) throw ApiError.notFound('User not found');

  const targetRoles = OPPOSITE_FEED_ROLE[me.role] || [];

  // Users I already follow — exclude from suggestions.
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const excludeIds = new Set([userId, ...following.map((f) => f.followingId)]);

  const candidates = await prisma.user.findMany({
    where: {
      role: { in: targetRoles },
      status: 'ACTIVE',
      id: { notIn: Array.from(excludeIds) },
    },
    orderBy: { createdAt: 'desc' },
    take,
    ...userInclude,
  });

  return candidates.map(shapeUser);
}

async function status(followerId, followingId) {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  return { isFollowing: !!row };
}

module.exports = {
  follow,
  unfollow,
  listFollowing,
  listFollowers,
  listSuggestions,
  status,
};
