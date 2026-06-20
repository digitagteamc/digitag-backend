const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const { ROLES } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const s3UploadService = require('../../services/s3/s3Upload.service');
const admin = require('../../config/firebase');
const logger = require('../../utils/logger');

async function sendFcm(fcmToken, data, notification = null) {
  if (!fcmToken) return;
  try {
    const msg = { token: fcmToken, data, android: { priority: 'high' } };
    if (notification) msg.notification = notification;
    await admin.messaging().send(msg);
  } catch (err) {
    logger.error('[FCM] send failed', { err: err.message });
  }
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

function shapeOwner(user, postRole) {
  if (!user) return null;
  const role = postRole || user.role;
  const profile = role === ROLES.CREATOR ? user.creatorProfile : user.freelancerProfile;
  if (!profile) return { id: user.id, role, name: null, profilePicture: null, location: null, languages: null, experience: null, category: null };

  // Format languages: prefer the array, fall back to single language string
  const langsArr = profile.languages && profile.languages.length > 0
    ? profile.languages
    : profile.language ? [profile.language] : [];
  const languages = langsArr.join(', ') || null;

  // Normalize: creatorProfile stores it as String ("Intermediate"), freelancerProfile as enum ("INTERMEDIATE")
  const expKey = profile.experienceLevel ? profile.experienceLevel.toUpperCase() : null;
  const experience = expKey ? (EXP_LABEL[expKey] || profile.experienceLevel) : null;

  return {
    id: user.id,
    role,
    name: profile.name,
    profilePicture: profile.profilePicture,
    location: profile.location,
    languages,
    experience,
    category: profile.category || null,
    categories: Array.isArray(profile.categories) ? profile.categories : [],
  };
}

function shapePost(post) {
  if (!post) return post;
  const { user, ...rest } = post;
  return { ...rest, owner: shapeOwner(user, post.role) };
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
    },
    include: buildPostInclude(),
  });

  // Notify accepted-collaboration connections about the new post.
  const shaped = shapePost(post);
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
          sender: { select: { id: true, fcmToken: true } },
          receiver: { select: { id: true, fcmToken: true } },
        },
      });
      await Promise.all(
        collabs.map((c) => {
          const other = c.sender.id === user.id ? c.receiver : c.sender;
          return sendFcm(
            other.fcmToken,
            { type: 'NEW_POST', postId: post.id },
            { title: `${posterName} posted`, body: preview },
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

  const post = await prisma.post.update({
    where: { id },
    data,
    include: buildPostInclude(),
  });
  return shapePost(post);
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
}

async function getPostById(id) {
  const post = await prisma.post.findFirst({
    where: { id, isActive: true },
    include: buildPostInclude(),
  });
  if (!post) throw ApiError.notFound(MESSAGES.POST.NOT_FOUND);
  return shapePost(post);
}

async function listMyPosts(user, query = {}) {
  return listUserPosts(user.id, query);
}

async function listUserPosts(userId, query = {}) {
  const { skip, take, page, limit } = parsePagination(query);

  const where = { userId, isActive: true };
  if (query.collaborationType) where.collaborationType = query.collaborationType;

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

  return {
    items: items.map(shapePost),
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
  const [rows, total] = await Promise.all([
    prisma.savedPost.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { post: { include: buildPostInclude() } },
    }),
    prisma.savedPost.count({ where: { userId } }),
  ]);
  const items = rows.map(r => shapePost(r.post)).filter(Boolean);
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
};
