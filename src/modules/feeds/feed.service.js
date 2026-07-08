const { prisma } = require('../../config/db');
const { OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const { buildPostInclude, shapePost, resolveCategoryMap, notExpiredWhere } = require('../posts/post.service');
const cache = require('../../services/cache/cache.service');

// Feed TTL: 90 seconds — fresh enough for real-time feel, saves massive DB load
const FEED_TTL = 90;

function feedCacheKey(userId, role, query) {
  const q = [
    query.page || 1,
    query.limit || 10,
    query.collaborationType || '',
    query.location || '',
    query.search || '',
    query.categoryId || '',
  ].join(':');
  return `feed:${userId}:${role}:${q}`;
}

async function getFeed(user, query = {}) {
  // Skip cache for search/filter queries — those need live results
  const isFiltered = query.search || query.location || query.collaborationType || query.categoryId;
  const cacheKey = feedCacheKey(user.id, user.role, query);

  if (!isFiltered) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const { skip, take, page, limit } = parsePagination(query);
  const targetRoles = OPPOSITE_FEED_ROLE[user.role] || [];

  const where = {
    isActive: true,
    role: { in: targetRoles },
    ...notExpiredWhere(),
  };

  // Blocked users' posts must never appear in the blocker's feed.
  const blocks = await prisma.block.findMany({ where: { blockerId: user.id }, select: { blockedId: true } });
  if (blocks.length) where.userId = { notIn: blocks.map((b) => b.blockedId) };

  if (query.collaborationType) where.collaborationType = query.collaborationType;
  if (query.location) where.location = { contains: query.location, mode: 'insensitive' };
  if (query.search) where.description = { contains: query.search, mode: 'insensitive' };

  // Explicit category filter from query takes precedence
  if (query.categoryId) {
    where.user = {
      OR: [
        { creatorProfile: { categoryId: query.categoryId } },
        { freelancerProfile: { categoryId: query.categoryId } },
      ],
    };
  }

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: buildPostInclude(),
    }),
    prisma.post.count({ where }),
  ]);

  const categoryMap = await resolveCategoryMap(items);
  const result = {
    items: items.map((p) => shapePost(p, categoryMap)),
    meta: buildPaginationMeta({ total, page, limit }),
  };

  if (!isFiltered) await cache.set(cacheKey, result, FEED_TTL);

  return result;
}

// Called from post.service.js after a new post is created — clears feed for that user's role
async function invalidateFeedCache(userId, role) {
  await cache.delPattern(`feed:${userId}:${role}:*`);
}

// Feed cache keys are per-viewer (feed:viewerId:viewerRole:...), so a new post from one
// user can't be targeted at just their own key — every viewer who might see it needs their
// cached feed cleared. Simplest correct fix: drop the whole feed cache on any post change.
async function invalidateAllFeeds() {
  await cache.delPattern('feed:*');
}

module.exports = { getFeed, invalidateFeedCache, invalidateAllFeeds };
