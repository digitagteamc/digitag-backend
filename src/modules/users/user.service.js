const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ROLES } = require('../../constants/roles');
const categoryService = require('../categories/category.service');

async function getUserIdByTag(tagId) {
  const [creator, freelancer] = await Promise.all([
    prisma.creatorProfile.findFirst({ where: { tagId: { equals: tagId, mode: 'insensitive' } }, select: { userId: true } }),
    prisma.freelancerProfile.findFirst({ where: { tagId: { equals: tagId, mode: 'insensitive' } }, select: { userId: true } }),
  ]);
  const match = creator || freelancer;
  if (!match) throw ApiError.notFound('Profile not found');
  return { userId: match.userId };
}

// Fire-and-forget — a logging failure must never break loading someone's
// profile. Self-views don't count (viewing your own profile isn't a "view"),
// and there's no viewerId at all for guests. Upsert on the unique pair keeps
// this to one row per viewer, refreshing viewedAt, rather than growing
// unbounded for repeat visits — which also gives "most recent first" free.
function logProfileView(viewerId, viewedId) {
  if (!viewerId || viewerId === viewedId) return;
  prisma.profileView
    .upsert({
      where: { viewerId_viewedId: { viewerId, viewedId } },
      create: { viewerId, viewedId },
      update: { viewedAt: new Date() },
    })
    .catch(() => {});
}

/** Premium "Who Viewed My Profile" — gated on the caller's own isPremium,
 *  not the viewed users'; views are logged for everyone so upgrading
 *  immediately surfaces past views too, not just future ones. */
async function getProfileViewers(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPremium: true } });
  if (!user?.isPremium) throw ApiError.forbidden('Who Viewed My Profile is a Premium feature.');

  const views = await prisma.profileView.findMany({
    where: { viewedId: userId },
    orderBy: { viewedAt: 'desc' },
    take: 100,
    include: {
      viewer: {
        select: {
          id: true,
          role: true,
          creatorProfile: { select: { name: true, profilePicture: true } },
          freelancerProfile: { select: { name: true, profilePicture: true } },
        },
      },
    },
  });

  return views.map((v) => {
    const profile = v.viewer.creatorProfile || v.viewer.freelancerProfile;
    return {
      userId: v.viewer.id,
      role: v.viewer.role,
      name: profile?.name || null,
      profilePicture: profile?.profilePicture || null,
      viewedAt: v.viewedAt,
    };
  });
}

async function getUserById(id, viewerId) {
  logProfileView(viewerId, id);
  const [user, followerCount, followingCount, collabCount, instagramAccounts] = await Promise.all([
    // This endpoint is publicly browsable (no auth required) — select only
    // profile-facing fields, never mobileNumber/fcmToken/status/etc.
    prisma.user.findUnique({
      // status: 'ACTIVE' in the where, not just the select — a deleted/
      // suspended user's full profile must 404, not just hide their posts.
      where: { id, status: 'ACTIVE' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        isPremium: true,
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
    prisma.instagramVerification.findMany({
      where: { userId: id, status: 'VERIFIED' },
      select: { id: true, instagramUsername: true, followers: true, verifiedAt: true },
      orderBy: { verifiedAt: 'asc' },
    }),
  ]);
  if (!user) throw ApiError.notFound('User not found');

  // Profiles store `categories` as raw Category-table UUIDs — resolve them to
  // slugs/names so the app can display them instead of raw ids.
  const categoryMap = await categoryService.resolveCategoryMap([
    ...(user.creatorProfile?.categories || []),
    ...(user.freelancerProfile?.categories || []),
  ]);
  const attachResolvedCategories = (profile) => {
    if (!profile) return profile;
    const resolved = (profile.categories || []).map((cid) => categoryMap.get(cid)).filter(Boolean);
    return { ...profile, categorySlugs: resolved.map((c) => c.slug), categoryNames: resolved.map((c) => c.name) };
  };

  return {
    ...user,
    creatorProfile: attachResolvedCategories(user.creatorProfile),
    freelancerProfile: attachResolvedCategories(user.freelancerProfile),
    followerCount,
    followingCount,
    collabCount,
    instagramAccounts,
  };
}

async function recomputeProfileCompletion(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { creatorProfile: true, freelancerProfile: true, brandProfile: true },
  });
  if (!user) return false;

  const profile = user.role === ROLES.CREATOR
    ? user.creatorProfile
    : user.role === ROLES.BRAND
      ? user.brandProfile
      : user.freelancerProfile;
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

const PRIVACY_FIELDS = {
  isDiscoverable: true,
  showOnlineStatus: true,
  shareDataForPersonalization: true,
  pushNotificationsEnabled: true,
  notifyCategoryPosts: true,
  preferredLanguage: true,
};

async function getPrivacySettings(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PRIVACY_FIELDS });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function updatePrivacySettings(userId, data) {
  const allowed = {};
  for (const key of Object.keys(PRIVACY_FIELDS)) {
    if (data[key] !== undefined) allowed[key] = data[key];
  }
  const user = await prisma.user.update({ where: { id: userId }, data: allowed, select: PRIVACY_FIELDS });
  return user;
}

// "Download My Data" — everything the user themselves created or that
// identifies them, in one JSON document. Deliberately excludes the other
// party's private details in shared records (e.g. a collaborator's phone
// number) — this is an export of *your* data, not a backdoor into theirs.
async function exportMyData(userId) {
  const [user, posts, sentCollabs, receivedCollabs, messages, follows, followers, blocks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, mobileNumber: true, countryCode: true, role: true, isVerified: true,
        isProfileCompleted: true, isPremium: true, createdAt: true,
        creatorProfile: true, freelancerProfile: true,
        ...PRIVACY_FIELDS,
      },
    }),
    prisma.post.findMany({ where: { userId }, select: { id: true, description: true, imageUrl: true, location: true, collaborationType: true, budget: true, createdAt: true } }),
    prisma.collaboration.findMany({ where: { senderId: userId }, select: { id: true, status: true, message: true, createdAt: true, receiverId: true } }),
    prisma.collaboration.findMany({ where: { receiverId: userId }, select: { id: true, status: true, message: true, createdAt: true, senderId: true } }),
    prisma.message.findMany({ where: { senderId: userId }, select: { id: true, content: true, createdAt: true, conversationId: true }, orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true, createdAt: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true, createdAt: true } }),
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true, createdAt: true } }),
  ]);
  if (!user) throw ApiError.notFound('User not found');

  return {
    exportedAt: new Date().toISOString(),
    account: user,
    posts,
    collaborationsSent: sentCollabs,
    collaborationsReceived: receivedCollabs,
    messagesSent: messages,
    following: follows,
    followers,
    blockedUsers: blocks,
  };
}

module.exports = {
  getUserById,
  getUserIdByTag,
  getUserStats,
  getProfileViewers,
  recomputeProfileCompletion,
  getOnboardingStatus,
  getPrivacySettings,
  updatePrivacySettings,
  exportMyData,
};
