const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const { ROLES } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const s3UploadService = require('../../services/s3/s3Upload.service');
const push = require('../../services/push/push.service');
const logger = require('../../utils/logger');
const categoryService = require('../categories/category.service');

// Lazy require to avoid a circular dependency — feed.service.js requires post.service.js
// for buildPostInclude/shapePost, so loading invalidateAllFeeds at the top here would grab
// an incomplete exports object. Resolving it at call time (after both modules finish
// loading) sidesteps that.
function invalidateAllFeeds(...args) {
  return require('../feeds/feed.service').invalidateAllFeeds(...args);
}

const EXP_LABEL = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

function buildPostInclude() {
  return {
    user: {
      select: {
        id: true,
        role: true,
        mobileNumber: true,
        isPremium: true,
        creatorProfile: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            location: true,
            categoryId: true,
            category: { select: { id: true, name: true, slug: true } },
            categories: true,
            languages: true,
            language: true,
            experienceLevel: true,
          },
        },
        freelancerProfile: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            location: true,
            categoryId: true,
            category: { select: { id: true, name: true, slug: true } },
            categories: true,
            languages: true,
            language: true,
            experienceLevel: true,
            skills: true,
          },
        },
      },
    },
  };
}

// Profiles store `categories` as raw Category-table UUIDs (multi-select), not slugs/names.
// Explore/Home filter tabs compare against human-readable slugs/names, so posts need those
// UUIDs resolved before the frontend can match anything. Batched across a whole list of
// posts (one query) rather than per-post, to avoid an N+1 query per feed page.
async function resolveCategoryMap(posts) {
  const ids = [];
  for (const post of posts) {
    const u = post?.user;
    if (!u) continue;
    ids.push(...(u.creatorProfile?.categories || []), ...(u.freelancerProfile?.categories || []));
  }
  return categoryService.resolveCategoryMap(ids);
}

function shapeOwner(user, postRole, categoryMap = new Map()) {
  if (!user) return null;
  const role = postRole || user.role;
  const profile = role === ROLES.CREATOR ? user.creatorProfile : user.freelancerProfile;
  if (!profile) {
    return {
      id: user.id, role, name: null, profilePicture: null, location: null, languages: null,
      experience: null, category: null, categories: [], categorySlugs: [], categoryNames: [],
      isPremium: Boolean(user.isPremium),
    };
  }

  // Format languages: prefer the array, fall back to single language string
  const langsArr = profile.languages && profile.languages.length > 0
    ? profile.languages
    : profile.language ? [profile.language] : [];
  const languages = langsArr.join(', ') || null;

  // Normalize: creatorProfile stores it as String ("Intermediate"), freelancerProfile as enum ("INTERMEDIATE")
  const expKey = profile.experienceLevel ? profile.experienceLevel.toUpperCase() : null;
  const experience = expKey ? (EXP_LABEL[expKey] || profile.experienceLevel) : null;

  const rawCategories = Array.isArray(profile.categories) ? profile.categories : [];
  const resolvedCategories = rawCategories.map((id) => categoryMap.get(id)).filter(Boolean);

  return {
    id: user.id,
    role,
    name: profile.name,
    profilePicture: profile.profilePicture,
    location: profile.location,
    languages,
    experience,
    category: profile.category || null,
    categories: rawCategories,
    categorySlugs: resolvedCategories.map((c) => c.slug),
    categoryNames: resolvedCategories.map((c) => c.name),
    isPremium: Boolean(user.isPremium),
  };
}

function shapePost(post, categoryMap = new Map()) {
  if (!post) return post;
  const { user, ...rest } = post;
  return { ...rest, owner: shapeOwner(user, post.role, categoryMap) };
}

// A post with no expiry (boostHours omitted) stays live forever. One that was
// boosted stops being shown to anyone but its own owner once this time passes.
function notExpiredWhere() {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}

function boostHoursToExpiresAt(boostHours) {
  if (!boostHours) return null;
  return new Date(Date.now() + boostHours * 60 * 60 * 1000);
}

async function createPost(user, data) {
  const post = await prisma.post.create({
    data: {
      userId: user.id,
      role: user.role,
      description: data.description,
      location: data.location || null,
      collaborationType: data.collaborationType || 'UNPAID',
      category: data.category || null,
      budget: data.budget || null,
      imageUrl: data.imageUrl || null,
      imageKey: data.imageKey || null,
      expiresAt: boostHoursToExpiresAt(data.boostHours),
    },
    include: buildPostInclude(),
  });

  await invalidateAllFeeds();

  // Notify accepted-collaboration connections about the new post.
  const shaped = shapePost(post, await resolveCategoryMap([post]));
  const posterName = shaped.owner?.name || 'Someone';
  const preview = data.description ? data.description.slice(0, 60) : 'Check out my new post';
  setImmediate(async () => {
    try {
      const collabs = await prisma.collaboration.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ senderId: user.id }, { receiverId: user.id }],
        },
        select: {
          sender: { select: { id: true } },
          receiver: { select: { id: true } },
        },
      });
      await Promise.all(
        collabs.map((c) => {
          const other = c.sender.id === user.id ? c.receiver : c.sender;
          return push.sendToUser(other.id, (t) =>
            push.notificationMessage(
              t,
              { type: 'NEW_POST', postId: post.id },
              { title: `${posterName} posted`, body: preview },
            ),
          );
        }),
      );
    } catch (err) {
      logger.error('[FCM] post notification failed', { err: err.message });
    }
  });

  return shaped;
}

async function updatePost(user, id, data) {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing || !existing.isActive) throw ApiError.notFound(MESSAGES.POST.NOT_FOUND);
  if (existing.userId !== user.id) throw ApiError.forbidden(MESSAGES.POST.NOT_OWNER);

  if (data.imageKey && existing.imageKey && data.imageKey !== existing.imageKey) {
    await s3UploadService.deleteObject(existing.imageKey);
  }

  const { boostHours, ...rest } = data;
  const updateData = boostHours !== undefined ? { ...rest, expiresAt: boostHoursToExpiresAt(boostHours) } : rest;

  const post = await prisma.post.update({
    where: { id },
    data: updateData,
    include: buildPostInclude(),
  });
  await invalidateAllFeeds();
  return shapePost(post, await resolveCategoryMap([post]));
}

async function deletePost(user, id) {
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing || !existing.isActive) throw ApiError.notFound(MESSAGES.POST.NOT_FOUND);
  if (existing.userId !== user.id) throw ApiError.forbidden(MESSAGES.POST.NOT_OWNER);

  await prisma.post.update({
    where: { id },
    data: { isActive: false },
  });

  if (existing.imageKey) {
    await s3UploadService.deleteObject(existing.imageKey);
  }

  await invalidateAllFeeds();
}

async function getPostById(id, viewerId) {
  const post = await prisma.post.findFirst({
    where: { id, isActive: true },
    include: buildPostInclude(),
  });
  if (!post) throw ApiError.notFound(MESSAGES.POST.NOT_FOUND);
  // A boosted post that's expired is invisible to everyone except its owner.
  const isExpired = post.expiresAt && post.expiresAt <= new Date();
  if (isExpired && post.userId !== viewerId) throw ApiError.notFound(MESSAGES.POST.NOT_FOUND);
  return shapePost(post, await resolveCategoryMap([post]));
}

async function listMyPosts(user, query = {}) {
  return listUserPosts(user.id, query, user.id);
}

async function listUserPosts(userId, query = {}, viewerId) {
  const { skip, take, page, limit } = parsePagination(query);

  const where = { userId, isActive: true };
  if (query.collaborationType) where.collaborationType = query.collaborationType;
  // Owners see all of their own posts (including expired boosts); anyone else
  // browsing someone's posts only sees the ones still live.
  if (viewerId !== userId) Object.assign(where, notExpiredWhere());

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
  return {
    items: items.map((p) => shapePost(p, categoryMap)),
    meta: buildPaginationMeta({ total, page, limit }),
  };
}

async function savePost(userId, postId) {
  await prisma.savedPost.upsert({
    where: { userId_postId: { userId, postId } },
    update: {},
    create: { userId, postId },
  });
  return { saved: true };
}

async function unsavePost(userId, postId) {
  await prisma.savedPost.deleteMany({ where: { userId, postId } });
  return { saved: false };
}

async function listSavedPosts(userId, query = {}) {
  const { limit = 20, page = 1 } = parsePagination(query);
  const skip = (page - 1) * limit;
  const where = { userId, post: notExpiredWhere() };
  const [rows, total] = await Promise.all([
    prisma.savedPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { post: { include: buildPostInclude() } },
    }),
    prisma.savedPost.count({ where }),
  ]);
  const categoryMap = await resolveCategoryMap(rows.map((r) => r.post));
  const items = rows.map(r => shapePost(r.post, categoryMap)).filter(Boolean);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

async function getSavedPostIds(userId) {
  const rows = await prisma.savedPost.findMany({
    where: { userId },
    select: { postId: true },
  });
  return rows.map(r => r.postId);
}

module.exports = {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  listMyPosts,
  listUserPosts,
  savePost,
  unsavePost,
  listSavedPosts,
  getSavedPostIds,
  buildPostInclude,
  shapePost,
  resolveCategoryMap,
  notExpiredWhere,
};
