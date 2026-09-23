const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ROLES, OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const { assertNotBlocked, isBlockedBetween } = require('../blocks/block.service');
const push = require('../../services/push/push.service');
const categoryService = require('../categories/category.service');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    isPremium: true,
    creatorProfile: { select: { name: true, profilePicture: true, location: true, bio: true, categories: true, instagramHandle: true, twitterHandle: true, facebookHandle: true } },
    freelancerProfile: { select: { name: true, profilePicture: true, location: true, bio: true, categories: true, skills: true, instagramHandle: true, twitterHandle: true, facebookHandle: true } },
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
    // Included so screens listing suggestions don't have to fetch each
    // user's full profile separately just to show skills/socials.
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    instagramHandle: profile?.instagramHandle || null,
    twitterHandle: profile?.twitterHandle || null,
    facebookHandle: profile?.facebookHandle || null,
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

async function listSuggestions(userId, { page, limit } = {}) {
  // Was a flat take-only fetch with no page concept at all — every call
  // returned the exact same top-N recent signups, so a caller wanting more
  // had no way to actually get more, only a bigger single batch. Real
  // page/skip now, same 50-per-page cap as before, kept backward compatible:
  // no page passed still behaves exactly like the old default (page 1).
  const { skip, take, page: p, limit: l } = parsePagination({ page, limit }, { limit: 20, maxLimit: 50 });

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) throw ApiError.notFound('User not found');

  const targetRoles = OPPOSITE_FEED_ROLE[me.role] || [];

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

  const [total, candidates] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      ...userInclude,
    }),
  ]);

  // Profiles store `categories` as raw Category-table UUIDs — resolve them to
  // names so the suggestion cards can show what the person does instead of a
  // generic "Suggested for you" caption.
  const categoryMap = await categoryService.resolveCategoryMap(
    candidates.flatMap((c) => (c.creatorProfile || c.freelancerProfile)?.categories || []),
  );

  return {
    data: candidates.map((c) => shapeUser(c, categoryMap)),
    meta: buildPaginationMeta({ total, page: p, limit: l }),
  };
}

// listSuggestions above is deliberately capped at 50 recent signups across
// every category combined — fine for "people you might know", useless for
// "show me everyone in category X" (a category with more matches than fit
// in that 50-user recency sample just never surfaces most of its members,
// no matter how high a caller raises its own limit). This queries the
// category assignment directly instead, so a category with genuinely 60
// members returns something close to all 60, paginated properly.
async function listByCategory(user, { categorySlug, page, limit } = {}) {
  const category = await categoryService.getCategoryBySlug(categorySlug);
  const { skip, take, page: p, limit: l } = parsePagination({ page, limit }, { limit: 30, maxLimit: 100 });

  // Same "opposite role" convention feed.service.js uses — a guest (no
  // user) gets the same default browsing experience as an unregistered
  // visitor sees elsewhere: Creator-style tabs, i.e. Freelancer profiles.
  const targetRoles = user ? (OPPOSITE_FEED_ROLE[user.role] || []) : OPPOSITE_FEED_ROLE[ROLES.CREATOR];

  const excludeIds = user ? [user.id] : [];
  // Checks both the single primary categoryId and the multi-select
  // categories[] array — a profile with several categories (freelancers
  // especially) still matches on any one of them, not just whichever
  // happens to be "primary".
  const categoryMatch = { OR: [{ categoryId: category.id }, { categories: { has: category.id } }] };

  const where = {
    role: { in: targetRoles },
    status: 'ACTIVE',
    isProfileCompleted: true,
    id: { notIn: excludeIds },
    OR: [{ creatorProfile: categoryMatch }, { freelancerProfile: categoryMatch }],
  };

  const [total, candidates] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      ...userInclude,
    }),
  ]);

  const categoryMap = await categoryService.resolveCategoryMap(
    candidates.flatMap((c) => (c.creatorProfile || c.freelancerProfile)?.categories || []),
  );

  return {
    data: candidates.map((c) => shapeUser(c, categoryMap)),
    meta: buildPaginationMeta({ total, page: p, limit: l }),
  };
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
  listByCategory,
  status,
};
