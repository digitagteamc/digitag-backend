const { prisma } = require('../../config/db');
const { ROLES, OPPOSITE_FEED_ROLE } = require('../../constants/roles');
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
  // Guests (no account) get an anonymous, uncached view — there's no stable per-viewer
  // cache identity for them, and volume is low enough that it's not worth inventing one.
  const cacheKey = user ? feedCacheKey(user.id, user.role, query) : null;

  if (cacheKey && !isFiltered) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const { skip, take, page, limit } = parsePagination(query);
  // A logged-in user sees the opposite role's posts. A guest has no role yet — default
  // them to the same browsing experience an unregistered visitor lands on elsewhere in
  // the app (Creator-style tabs), i.e. Freelancer posts, so the feed and tabs agree.
  const targetRoles = user ? (OPPOSITE_FEED_ROLE[user.role] || []) : OPPOSITE_FEED_ROLE[ROLES.CREATOR];

  const where = {
    isActive: true,
    role: { in: targetRoles },
    ...notExpiredWhere(),
  };

  // Blocks cut visibility both ways: posts of anyone I blocked AND anyone who
  // blocked me disappear from my feed. Guests have no blocklist of their own.
  if (user) {
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
      select: { blockerId: true, blockedId: true },
    });
    if (blocks.length) {
      const hiddenIds = blocks.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));
      where.userId = { notIn: hiddenIds };
    }
  }

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
      // Premium posts sort above all free posts, newest-first within each tier.
      // v1: a flat partition, not a decaying boost — simplest thing that gives
      // Premium real value. Worth revisiting if a stale premium post ever
      // visibly buries fresh free content in practice.
      orderBy: [{ user: { isPremium: 'desc' } }, { createdAt: 'desc' }],
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

  if (cacheKey && !isFiltered) await cache.set(cacheKey, result, FEED_TTL);

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
