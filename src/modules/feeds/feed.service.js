const { prisma } = require('../../config/db');
const { ROLES, OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const { buildPostInclude, shapePost, resolveCategoryMap, notExpiredWhere } = require('../posts/post.service');
const categoryService = require('../categories/category.service');
const cache = require('../../services/cache/cache.service');

// Feed TTL: 90 seconds — fresh enough for real-time feel, saves massive DB load
const FEED_TTL = 90;

// A creator's post names the type of freelancer it wants (Post.category, free
// text picked from the app's fixed CREATOR_CATEGORIES list in create-post.tsx).
// Freelancer profiles categorise themselves against the Category table instead.
// This maps each post-side label to the freelancer-category slugs it's relevant
// to, so a freelancer's feed can show only work they actually do. Labels with
// no entry here (e.g. 'Models', which has no freelancer category) and null
// categories deliberately fail open — a post must never vanish for everyone
// just because we can't classify it.
const POST_CATEGORY_TO_FREELANCER_SLUGS = {
  'Photography': ['photography'],
  'Editors': ['editors', 'video-editing'],
  'Videography': ['editors', 'video-editing'],
  'Growth Specialist': ['social-media'],
  'Script Writers': ['content-writing'],
  'Styling & makeup': ['styling-makeup'],
  'Fashion Designers': ['styling-makeup', 'graphic-design'],
  'Property Rental': ['property-rental'],
  'Voice Over': ['music-production'],
};

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

  // A freelancer's feed (Home and Explore both come through here) only shows
  // creator posts asking for what that freelancer actually does — a video
  // editor shouldn't wade through photography or modelling requests. Hidden
  // labels are computed (rather than allowed ones) so unknown/legacy labels
  // and category-less posts stay visible to everyone.
  if (user && user.role === ROLES.FREELANCER) {
    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
      select: { categories: true },
    });
    const catIds = profile?.categories || [];
    if (catIds.length) {
      const catMap = await categoryService.resolveCategoryMap(catIds);
      const mySlugs = new Set(catIds.map((id) => catMap.get(id)?.slug).filter(Boolean));
      const hiddenLabels = Object.entries(POST_CATEGORY_TO_FREELANCER_SLUGS)
        .filter(([, slugs]) => !slugs.some((s) => mySlugs.has(s)))
        .map(([label]) => label);
      if (hiddenLabels.length) {
        where.AND = [
          ...(where.AND || []),
          { OR: [{ category: null }, { category: { notIn: hiddenLabels } }] },
        ];
      }
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
