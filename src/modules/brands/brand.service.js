const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const { ROLES } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const { generateTagId } = require('../../utils/generateTagId');
const { ensureUserTag } = require('../../utils/generateUserTag');
const { isEmailVerifiedForUser } = require('../../services/email/emailOtp.service');
const s3UploadService = require('../../services/s3/s3Upload.service');
const userService = require('../users/user.service');
const categoryService = require('../categories/category.service');
const { assertApprovedBrand } = require('./brandApproval');
const { buildPostInclude, shapePost, resolveCategoryMap, notExpiredWhere } = require('../posts/post.service');

// -------------------------
// Profile
// -------------------------
// Not built on _shared/profileService: that factory mirrors name/email/picture
// onto the account's sibling Creator/Freelancer profile, which is right for a
// person switching roles but wrong for a brand (brand name != person's name).

async function ensureBrandUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== ROLES.BRAND) throw ApiError.forbidden(MESSAGES.PROFILE.ROLE_MISMATCH);
  return user;
}

async function ensureEmailUsable(userId, email, accountId) {
  if (!email) return;
  const existing = await prisma.brandProfile.findFirst({
    where: { email, NOT: accountId ? { user: { accountId } } : { userId } },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict(MESSAGES.PROFILE.EMAIL_IN_USE);
  if (!(await isEmailVerifiedForUser(userId, email))) {
    throw ApiError.badRequest('Please verify this email address before continuing.');
  }
}

function emptyToNull(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = v === '' ? null : v;
  return out;
}

// Fields an admin verified — changing any of them sends the brand back to review.
const KYC_FIELDS = ['name', 'pan', 'gstin'];

// Characters 3–12 of a GSTIN are the holder's PAN.
function panFromGstin(gstin) {
  const pan = (gstin || '').slice(2, 12);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw ApiError.badRequest('Enter a valid GST number (15 characters, e.g. 36ABCDE1234F1Z5).');
  return pan;
}

async function createProfile(userId, data) {
  const user = await ensureBrandUser(userId);
  const existing = await prisma.brandProfile.findUnique({ where: { userId } });
  if (existing) throw ApiError.conflict(MESSAGES.PROFILE.ALREADY_EXISTS);

  const clean = emptyToNull(data);
  if (!clean.pan) clean.pan = panFromGstin(clean.gstin);
  await ensureEmailUsable(userId, clean.email, user.accountId);

  const tagId = await generateTagId({ role: ROLES.BRAND, model: 'brandProfile' });
  const profile = await prisma.brandProfile.create({ data: { ...clean, userId, tagId, approvalStatus: 'PENDING' } });

  await ensureUserTag({ userId, role: ROLES.BRAND, location: clean.city, language: clean.language }).catch(() => {});
  await userService.recomputeProfileCompletion(userId);
  return profile;
}

async function updateProfile(userId, data) {
  const user = await ensureBrandUser(userId);
  const existing = await prisma.brandProfile.findUnique({ where: { userId } });
  if (!existing) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);

  const clean = emptyToNull(data);
  if (clean.gstin && !clean.pan) clean.pan = panFromGstin(clean.gstin);
  if (clean.email && clean.email !== existing.email) {
    await ensureEmailUsable(userId, clean.email, user.accountId);
  }
  if (clean.profilePictureKey && existing.profilePictureKey && clean.profilePictureKey !== existing.profilePictureKey) {
    await s3UploadService.deleteObject(existing.profilePictureKey).catch(() => {});
  }

  // A rejected brand editing its details is a resubmission; an approved brand
  // changing verified KYC details needs re-verification.
  const kycChanged = KYC_FIELDS.some((f) => clean[f] !== undefined && clean[f] !== existing[f]);
  if (existing.approvalStatus === 'REJECTED' || (existing.approvalStatus === 'APPROVED' && kycChanged)) {
    Object.assign(clean, { approvalStatus: 'PENDING', rejectionReason: null, reviewedAt: null, reviewedBy: null });
  }

  const profile = await prisma.brandProfile.update({ where: { userId }, data: clean });
  await userService.recomputeProfileCompletion(userId);
  return profile;
}

/** Drives the app's "pending approval" screen. */
async function getApprovalStatus(userId) {
  await ensureBrandUser(userId);
  const profile = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { approvalStatus: true, rejectionReason: true, reviewedAt: true },
  });
  if (!profile) return { hasProfile: false, status: null, approvalStatus: null, rejectionReason: null };
  return { hasProfile: true, status: profile.approvalStatus, ...profile };
}

// -------------------------
// Brand Home tab
// -------------------------

const HOME_LIMIT = 10;

const homeChannelSelect = {
  id: true, name: true, type: true, logoUrl: true, subscriberCount: true, category: true, isVerified: true,
};
const homeAdTypeSelect = { id: true, name: true, iconUrl: true, accentColor: true, description: true, sortOrder: true };
const celebritySelect = {
  id: true, name: true, photoUrl: true, role: true, followerCount: true, isVerified: true, profileUrl: true,
};

/** Everything the Brand Home tab renders, in one call: Top YouTube Channels,
 *  Ad Types and Celebrities — all admin-managed. */
async function getHome() {
  const [youtubeChannels, adTypes, celebrities] = await Promise.all([
    prisma.mediaChannel.findMany({
      where: { isActive: true, type: 'YOUTUBE' },
      orderBy: [{ subscriberCount: 'desc' }, { name: 'asc' }],
      take: HOME_LIMIT,
      select: homeChannelSelect,
    }),
    prisma.adType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: homeAdTypeSelect }),
    prisma.celebrity.findMany({
      where: { isActive: true },
      orderBy: [{ isVerified: 'desc' }, { followerCount: 'desc' }],
      take: HOME_LIMIT,
      select: celebritySelect,
    }),
  ]);
  return { youtubeChannels, adTypes, celebrities };
}

/** "See all" for the Celebrities section. */
async function listCelebrities(query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const where = { isActive: true };
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  const [items, total] = await Promise.all([
    prisma.celebrity.findMany({ where, orderBy: [{ isVerified: 'desc' }, { followerCount: 'desc' }], skip, take, select: celebritySelect }),
    prisma.celebrity.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

/** "See all" for Top YouTube Channels. */
async function listYoutubeChannels(query = {}) {
  const where = { isActive: true, type: 'YOUTUBE' };
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  return prisma.mediaChannel.findMany({
    where,
    orderBy: [{ subscriberCount: 'desc' }, { name: 'asc' }],
    select: homeChannelSelect,
  });
}

async function listAdTypes() {
  return prisma.adType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: homeAdTypeSelect });
}

// Public card fields only — PAN/GSTIN and review details stay private.
const publicBrandSelect = {
  id: true, userId: true, name: true, profilePicture: true, city: true, state: true, website: true,
  industry: true, bio: true, companySize: true, instagramHandle: true, youtubeHandle: true, tagId: true,
  approvalStatus: true, createdAt: true,
};

/** A brand's public profile, by brand profile id or by the brand's user id. */
async function getPublicProfile(id) {
  const profile = await prisma.brandProfile.findFirst({ where: { OR: [{ id }, { userId: id }] }, select: publicBrandSelect });
  if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
  return withDisplayFields(profile);
}

// The app's brand profile screen reads category / location / partnerSince.
function withDisplayFields(profile) {
  return {
    ...profile,
    category: profile.industry || null,
    location: [profile.city, profile.state].filter(Boolean).join(', ') || null,
    partnerSince: profile.createdAt,
  };
}

async function getMyProfile(userId) {
  await ensureBrandUser(userId);
  const profile = await prisma.brandProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound(MESSAGES.PROFILE.NOT_FOUND);
  return withDisplayFields(profile);
}

// -------------------------
// Requirement posts — brand side
// -------------------------

async function listMyPosts(user, query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const where = { userId: user.id, isActive: true };
  if (query.status) where.status = query.status;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: buildPostInclude() }),
    prisma.post.count({ where }),
  ]);

  // Applicant counts per post per status, one grouped query for the page.
  const counts = posts.length
    ? await prisma.collaboration.groupBy({
        by: ['postId', 'status'],
        where: { postId: { in: posts.map((p) => p.id) }, receiverId: user.id },
        _count: { _all: true },
      })
    : [];
  const byPost = new Map();
  for (const c of counts) {
    if (!byPost.has(c.postId)) byPost.set(c.postId, { total: 0, PENDING: 0, ACCEPTED: 0, DECLINED: 0, COMPLETED: 0, CANCELLED: 0 });
    const entry = byPost.get(c.postId);
    entry[c.status] = c._count._all;
    entry.total += c._count._all;
  }

  const categoryMap = await resolveCategoryMap(posts);
  return {
    items: posts.map((p) => ({
      ...shapePost(p, categoryMap),
      applicants: byPost.get(p.id) || { total: 0, PENDING: 0, ACCEPTED: 0, DECLINED: 0, COMPLETED: 0, CANCELLED: 0 },
    })),
    meta: buildPaginationMeta({ total, page, limit }),
  };
}

const applicantUserSelect = {
  id: true,
  role: true,
  isPremium: true,
  lastActiveAt: true,
  creatorProfile: {
    select: {
      name: true, profilePicture: true, location: true, bio: true, tagId: true, categories: true,
      languages: true, experienceLevel: true, portfolioUrl: true,
      instagramHandle: true, instagramFollowers: true, youtubeHandle: true, youtubeFollowers: true,
      facebookHandle: true, facebookFollowers: true, twitterHandle: true, twitterFollowers: true,
    },
  },
  freelancerProfile: {
    select: {
      name: true, profilePicture: true, location: true, bio: true, tagId: true, categories: true,
      languages: true, experienceLevel: true, portfolioUrl: true, skills: true, hourlyRate: true,
      availability: true, instagramHandle: true, instagramFollowers: true,
    },
  },
};

/** Everyone who tapped "Collab" on one of my requirement posts. Tapping an
 *  applicant opens their full profile via GET /users/:id; accepting goes
 *  through PATCH /collaborations/:id { action: 'ACCEPT' }, which unlocks chat. */
async function listApplicants(user, postId, { status } = {}) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true, isActive: true } });
  if (!post || !post.isActive) throw ApiError.notFound(MESSAGES.POST.NOT_FOUND);
  if (post.userId !== user.id) throw ApiError.forbidden(MESSAGES.POST.NOT_OWNER);

  const where = { postId, receiverId: user.id };
  if (status) where.status = status;

  const collabs = await prisma.collaboration.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: applicantUserSelect }, conversation: { select: { id: true } } },
  });

  const categoryMap = await categoryService.resolveCategoryMap(
    collabs.flatMap((c) => [...(c.sender.creatorProfile?.categories || []), ...(c.sender.freelancerProfile?.categories || [])]),
  );

  return collabs.map((c) => {
    const profile = c.sender.role === ROLES.CREATOR ? c.sender.creatorProfile : c.sender.freelancerProfile;
    const cats = (profile?.categories || []).map((id) => categoryMap.get(id)).filter(Boolean);
    return {
      collaborationId: c.id,
      status: c.status,
      message: c.message,
      createdAt: c.createdAt,
      respondedAt: c.respondedAt,
      conversationId: c.conversation?.id || null,
      applicant: {
        id: c.sender.id,
        role: c.sender.role,
        isPremium: Boolean(c.sender.isPremium),
        ...(profile || {}),
        categoryNames: cats.map((x) => x.name),
        categorySlugs: cats.map((x) => x.slug),
      },
    };
  });
}

// -------------------------
// Requirement posts — Creator / Freelancer side
// -------------------------

/** Brand requirements visible to me: Creators see every brand post,
 *  Freelancers only those the brand marked "freelancer required". Each item
 *  carries myCollaboration so the app can render Collab / Requested / Chat. */
async function listRequirements(user, query = {}) {
  const { skip, take, page, limit } = parsePagination(query);

  const where = {
    role: ROLES.BRAND,
    targetRoles: { has: user.role },
    isActive: true,
    isHidden: false,
    status: { not: 'CLOSED' },
    user: { status: 'ACTIVE' },
    ...notExpiredWhere(),
  };

  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
    select: { blockerId: true, blockedId: true },
  });
  if (blocks.length) {
    where.userId = { notIn: blocks.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId)) };
  }

  const and = [];
  if (query.collaborationType) where.collaborationType = query.collaborationType;
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  if (query.location) where.location = { contains: query.location, mode: 'insensitive' };
  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { user: { brandProfile: { name: { contains: query.search, mode: 'insensitive' } } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ boostedUntil: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip,
      take,
      include: buildPostInclude(),
    }),
    prisma.post.count({ where }),
  ]);

  const mine = posts.length
    ? await prisma.collaboration.findMany({
        where: { senderId: user.id, postId: { in: posts.map((p) => p.id) } },
        select: { id: true, postId: true, status: true, conversation: { select: { id: true } } },
      })
    : [];
  const mineByPost = new Map(mine.map((c) => [c.postId, { id: c.id, status: c.status, conversationId: c.conversation?.id || null }]));

  const categoryMap = await resolveCategoryMap(posts);
  return {
    items: posts.map((p) => ({ ...shapePost(p, categoryMap), myCollaboration: mineByPost.get(p.id) || null })),
    meta: buildPaginationMeta({ total, page, limit }),
  };
}

// -------------------------
// Dashboard
// -------------------------

async function getDashboard(user) {
  const [postsByStatus, applicantsByStatus, adRequestsByStatus, unreadNotifications] = await Promise.all([
    prisma.post.groupBy({ by: ['status'], where: { userId: user.id, isActive: true }, _count: { _all: true } }),
    prisma.collaboration.groupBy({
      by: ['status'],
      where: { receiverId: user.id, post: { userId: user.id } },
      _count: { _all: true },
    }),
    prisma.adRequest.groupBy({ by: ['status'], where: { brandUserId: user.id }, _count: { _all: true } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  return {
    posts: toMap(postsByStatus),
    applicants: toMap(applicantsByStatus),
    adRequests: toMap(adRequestsByStatus),
    unreadNotifications,
  };
}

module.exports = {
  assertApprovedBrand,
  createProfile,
  updateProfile,
  getMyProfile,
  getPublicProfile,
  getApprovalStatus,
  getHome,
  listYoutubeChannels,
  listAdTypes,
  listCelebrities,
  listMyPosts,
  listApplicants,
  listRequirements,
  getDashboard,
};
