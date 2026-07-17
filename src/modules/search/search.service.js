const { prisma } = require('../../config/db');
const { OPPOSITE_FEED_ROLE, ROLES } = require('../../constants/roles');
const { resolveCategoryMap } = require('../categories/category.service');
// Lazy require: feed.service.js requires post.service.js, and both live outside
// this module's own dependency chain, but requiring it at call time (rather than
// module load time) keeps this file safe if that chain ever grows a cycle back
// through search — same defensive pattern post.service.js uses for feed.service.js.
function getFeed(...args) {
  return require('../feeds/feed.service').getFeed(...args);
}

async function searchProfiles(user, q, limit = 20) {
    const query = q.trim();
    const targetRoles = OPPOSITE_FEED_ROLE[user.role] || [];

    const includeCreator = targetRoles.includes(ROLES.CREATOR);
    const includeFreelancer = targetRoles.includes(ROLES.FREELANCER);

    const [creators, freelancers] = await Promise.all([
        includeCreator ? prisma.creatorProfile.findMany({
            where: {
                name: { contains: query, mode: 'insensitive' },
                user: { status: 'ACTIVE', isDiscoverable: true },
            },
            select: {
                id: true,
                userId: true,
                name: true,
                profilePicture: true,
                location: true,
                categories: true,
                user: { select: { isPremium: true } },
            },
            orderBy: { name: 'asc' },
            take: limit,
        }) : Promise.resolve([]),
        includeFreelancer ? prisma.freelancerProfile.findMany({
            where: {
                name: { contains: query, mode: 'insensitive' },
                user: { status: 'ACTIVE', isDiscoverable: true },
            },
            select: {
                id: true,
                userId: true,
                name: true,
                profilePicture: true,
                location: true,
                categories: true,
                user: { select: { isPremium: true } },
            },
            orderBy: { name: 'asc' },
            take: limit,
        }) : Promise.resolve([]),
    ]);

    // Profiles store categories as raw Category-table UUIDs (see post.service.js's
    // resolveCategoryMap comment) — signup only ever writes the `categories` array,
    // never the legacy singular categoryId/category relation, so resolving from
    // that array is the only way category names actually come back non-empty.
    const allCategoryIds = [...creators, ...freelancers].flatMap((p) => p.categories || []);
    const categoryMap = await resolveCategoryMap(allCategoryIds);

    const shape = (p, role) => ({
        userId: p.userId,
        profileId: p.id,
        name: p.name,
        profilePicture: p.profilePicture || null,
        role,
        categoryNames: (p.categories || []).map((id) => categoryMap.get(id)?.name).filter(Boolean),
        categorySlugs: (p.categories || []).map((id) => categoryMap.get(id)?.slug).filter(Boolean),
        location: p.location || null,
        isPremium: Boolean(p.user?.isPremium),
    });

    const results = [
        ...creators.map((p) => shape(p, 'CREATOR')),
        ...freelancers.map((p) => shape(p, 'FREELANCER')),
    ].sort((a, b) => a.name.localeCompare(b.name));

    return results.slice(0, limit);
}

// Combined search: accounts (via searchProfiles) and posts (via the same
// getFeed a logged-in user's Explore tab uses), so post results respect the
// exact same visibility rules — opposite-role targeting, blocks, hidden
// freelancer categories, active/expiry/CLOSED status — as browsing does.
async function search(user, q, limit = 20) {
    const query = q.trim();
    const [users, feedResult] = await Promise.all([
        searchProfiles(user, query, limit),
        getFeed(user, { search: query, limit, page: 1 }),
    ]);
    return { users, posts: feedResult.items };
}

module.exports = { searchProfiles, search };
