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
          },
        },
      },
    },
  };
}

function shapeOwner(user, postRole) {
  if (!user) return null;
  // Use the role stored on the post (what the user was when they created it),
  // not the user's current role, to pick the right profile and label.
  const role = postRole || user.role;
  const profile = role === ROLES.CREATOR ? user.creatorProfile : user.freelancerProfile;
  return {
    id: user.id,
    role,
    name: profile ? profile.name : null,
    profilePicture: profile ? profile.profilePicture : null,
    location: profile ? profile.location : null,
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

module.exports = {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  listMyPosts,
  listUserPosts,
  buildPostInclude,
  shapePost,
};
