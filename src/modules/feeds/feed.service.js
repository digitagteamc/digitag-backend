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

// Interleaves posts round-robin by author (assumes `posts` is already sorted
// newest-first) so one prolific poster's several recent posts don't bury
// everyone else's — each author's most recent post surfaces before anyone's
// second post, their second before anyone's third, and so on. Author order
// is each author's own first appearance in the input, i.e. whoever posted
// most recently goes first.
function diversifyByAuthor(posts) {
  const byUser = new Map();
  for (const p of posts) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId).push(p);
  }
  const userOrder = [...byUser.keys()];
  const result = [];
  for (let round = 0; ; round++) {
    let addedAny = false;
    for (const uid of userOrder) {
      const authorPosts = byUser.get(uid);
      if (authorPosts[round]) {
        result.push(authorPosts[round]);
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }
  return result;
}

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
    status: { not: 'CLOSED' },
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
  // Keyword search matches whatever text a post actually carries — description,
  // category label, and location — not just the description, so a query like
  // "Mumbai" or "Photography" surfaces relevant posts too. Added as its own
  // where.AND entry (not where.OR) since where.OR is already claimed by
  // notExpiredWhere() above — overwriting it would silently let expired
  // boosted posts back into results whenever a search term is present.
  if (query.search) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { description: { contains: query.search, mode: 'insensitive' } },
          { category: { contains: query.search, mode: 'insensitive' } },
          { location: { contains: query.search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  // Explicit category filter from query takes precedence
  if (query.categoryId) {
    where.user = {
      OR: [
        { creatorProfile: { categoryId: query.categoryId } },
        { freelancerProfile: { categoryId: query.categoryId } },
      ],
    };
  }

  // Premium "Boost": a post with boostedUntil still in the future goes to the
  // very top of page 1, above even the passive Premium sort below — this is
  // the active, on-demand placement Boost is paying for, not just a tiebreak.
  // Fetched and excluded from the main query (rather than expressed as an
  // orderBy) because "boostedUntil > now" can't be a plain column sort: a
  // long-expired boost must never outrank fresh unboosted content just for
  // having a non-null timestamp.
  let boostedItems = [];
  if (page === 1) {
    const boosted = await prisma.post.findMany({
      where: { ...where, boostedUntil: { gt: new Date() } },
      orderBy: { boostedUntil: 'desc' },
      include: buildPostInclude(),
    });
    boostedItems = boosted;
  }
  const boostedIds = boostedItems.map((p) => p.id);
  if (boostedIds.length) where.id = { notIn: boostedIds };

  // Premium posts sort above all free posts (a flat partition, not a decaying
  // boost — simplest thing that gives Premium real value). Within each tier,
  // posts are diversified by author (see diversifyByAuthor) instead of a flat
  // createdAt sort, so a prolific poster's several recent posts don't crowd
  // out everyone else's — pagination is then sliced off this reordered list
  // rather than off the DB's own row order.
  const [lightPosts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: { id: true, userId: true, user: { select: { isPremium: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({ where }),
  ]);
  const premiumLight = lightPosts.filter((p) => p.user?.isPremium);
  const freeLight = lightPosts.filter((p) => !p.user?.isPremium);
  const orderedIds = [...diversifyByAuthor(premiumLight), ...diversifyByAuthor(freeLight)].map((p) => p.id);
  const pageIds = orderedIds.slice(skip, skip + take);
  const hydrated = pageIds.length
    ? await prisma.post.findMany({ where: { id: { in: pageIds } }, include: buildPostInclude() })
    : [];
  const hydratedById = new Map(hydrated.map((p) => [p.id, p]));
  const items = pageIds.map((id) => hydratedById.get(id)).filter(Boolean);

  const allItems = [...boostedItems, ...items];
  const categoryMap = await resolveCategoryMap(allItems);
  const result = {
    items: allItems.map((p) => shapePost(p, categoryMap)),
    meta: buildPaginationMeta({ total: total + boostedItems.length, page, limit }),
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
