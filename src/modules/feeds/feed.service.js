const { prisma } = require('../../config/db');
const { OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const { buildPostInclude, shapePost } = require('../posts/post.service');
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
  };

  if (query.collaborationType) where.collaborationType = query.collaborationType;
  if (query.location) where.location = { contains: query.location, mode: 'insensitive' };
  if (query.search) where.description = { contains: query.search, mode: 'insensitive' };
  if (query.categoryId) {
    where.OR = [
      { user: { creatorProfile: { categoryId: query.categoryId } } },
      { user: { freelancerProfile: { categoryId: query.categoryId } } },
    ];
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

  const result = {
    items: items.map(shapePost),
    meta: buildPaginationMeta({ total, page, limit }),
  };

  if (!isFiltered) await cache.set(cacheKey, result, FEED_TTL);

  return result;
}

// Called from post.service.js after a new post is created — clears feed for that user's role
async function invalidateFeedCache(userId, role) {
  await cache.delPattern(`feed:${userId}:${role}:*`);
}

module.exports = { getFeed, invalidateFeedCache };
