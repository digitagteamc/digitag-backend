const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const { assertNotBlocked, isBlockedBetween } = require('../blocks/block.service');
const push = require('../../services/push/push.service');
const categoryService = require('../categories/category.service');

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    isPremium: true,
    creatorProfile: { select: { name: true, profilePicture: true, location: true, bio: true, categories: true } },
    freelancerProfile: { select: { name: true, profilePicture: true, location: true, bio: true, categories: true } },
  },
};

function shapeUser(u, categoryMap) {
  if (!u) return null;
  const profile = u.creatorProfile || u.freelancerProfile;
  const categoryNames = categoryMap
    ? (profile?.categories || []).map((cid) => categoryMap.get(cid)?.name).filter(Boolean)
    : [];
  return {
    id: u.id,
    role: u.role,
    name: profile ? profile.name : null,
    profilePicture: profile ? profile.profilePicture : null,
    location: profile ? profile.location : null,
    bio: profile ? profile.bio : null,
    isPremium: Boolean(u.isPremium),
    categoryNames,
  };
}

async function follow(followerId, followingId, followerRole) {
  if (followerId === followingId) throw ApiError.badRequest('Cannot follow yourself');
  await assertNotBlocked(followerId, followingId);
  const other = await prisma.user.findUnique({ where: { id: followingId } });
  if (!other || other.status !== 'ACTIVE') throw ApiError.notFound('User not found');

  const allowedRoles = OPPOSITE_FEED_ROLE[followerRole] || [];
  if (!allowedRoles.includes(other.role)) {
    throw ApiError.forbidden('You can only follow users of a different role');
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  if (existing) return existing;

  const created = await prisma.follow.create({ data: { followerId, followingId } });

  const followerUser = await prisma.user.findUnique({
    where: { id: followerId },
    select: { creatorProfile: { select: { name: true } }, freelancerProfile: { select: { name: true } } },
  });
  const followerName = followerUser?.creatorProfile?.name || followerUser?.freelancerProfile?.name || 'Someone';
  // notificationMessage (not the data-only builders) — this is exactly what
  // makes it persist to the Notifications tab and show a foreground banner,
  // same as every other notification type.
  await push.sendToUser(followingId, (t) =>
    push.notificationMessage(
      t,
      { type: 'NEW_FOLLOWER', followerId },
      { title: 'New Follower', body: `${followerName} started following you` },
    ),
  );

  return created;
}

async function unfollow(followerId, followingId) {
  const result = await prisma.follow.deleteMany({ where: { followerId, followingId } });
  return { unfollowed: result.count > 0 };
}

// viewerId is the person asking to see the list — omitted (or equal to userId)
// when viewing your own. While either side has blocked the other, that
// person's followers/following stay hidden from the blocked party; the
// blocker themselves can still browse the blocked user's profile freely.
async function listFollowing(userId, viewerId) {
  if (viewerId && viewerId !== userId && (await isBlockedBetween(userId, viewerId))) return [];
  const rows = await prisma.follow.findMany({
    // A deleted/suspended account shouldn't keep appearing in someone else's
    // following/followers list — same status check as everywhere else.
    where: { followerId: userId, following: { status: 'ACTIVE' } },
    include: { following: userInclude },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => shapeUser(r.following));
}

async function listFollowers(userId, viewerId) {
  if (viewerId && viewerId !== userId && (await isBlockedBetween(userId, viewerId))) return [];
  const rows = await prisma.follow.findMany({
    where: { followingId: userId, follower: { status: 'ACTIVE' } },
    include: { follower: userInclude },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => shapeUser(r.follower));
}

async function listSuggestions(userId, { limit = 20, role, location, categorySlug } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) throw ApiError.notFound('User not found');

  const allowedTargetRoles = OPPOSITE_FEED_ROLE[me.role] || [];
  // Optional further narrowing (e.g. Brand's Home tab wants Creators-only for
  // one section, Freelancers-only for another) — falls back to every
  // opposite-role type when not given, same as before. Ignores a role not
  // actually in the allowed set rather than erroring, so a bad/stale param
  // just behaves like it wasn't passed.
  const targetRoles = role && allowedTargetRoles.includes(role) ? [role] : allowedTargetRoles;

  // Users I already follow — exclude from suggestions.
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const excludeIds = new Set([userId, ...following.map((f) => f.followingId)]);

  const where = {
    role: { in: targetRoles },
    status: 'ACTIVE',
    isProfileCompleted: true,
    id: { notIn: Array.from(excludeIds) },
  };
  // Both location and category live on whichever profile matches that row's
  // own role — an OR across both relations is safe even when targetRoles is
  // narrowed to one, since e.g. a CREATOR row's freelancerProfile is always
  // null anyway. Collected as separate AND entries (not both merged into one
  // where.OR) so passing both filters at once means "matches this location
  // AND this category", not "matches either".
  const andFilters = [];
  if (location) {
    andFilters.push({
      OR: [
        { creatorProfile: { location: { contains: location, mode: 'insensitive' } } },
        { freelancerProfile: { location: { contains: location, mode: 'insensitive' } } },
      ],
    });
  }
  if (categorySlug) {
    const cat = await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
    // An unknown slug should return zero results, not silently ignore the
    // filter — an id that can never match does exactly that.
    const catId = cat?.id || '__no_match__';
    andFilters.push({
      OR: [
        { creatorProfile: { categories: { has: catId } } },
        { freelancerProfile: { categories: { has: catId } } },
      ],
    });
  }
  if (andFilters.length) where.AND = andFilters;

  const candidates = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    ...userInclude,
  });

  // Profiles store `categories` as raw Category-table UUIDs — resolve them to
  // names so the suggestion cards can show what the person does instead of a
  // generic "Suggested for you" caption.
  const categoryMap = await categoryService.resolveCategoryMap(
    candidates.flatMap((c) => (c.creatorProfile || c.freelancerProfile)?.categories || []),
  );

  return candidates.map((c) => shapeUser(c, categoryMap));
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
