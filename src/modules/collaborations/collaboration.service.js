const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    creatorProfile: { select: { name: true, profilePicture: true, location: true } },
    freelancerProfile: { select: { name: true, profilePicture: true, location: true } },
  },
};

const postInclude = {
  select: {
    id: true,
    description: true,
    collaborationType: true,
    imageUrl: true,
    location: true,
    createdAt: true,
  },
};

// Two-user pair is always stored with the lexicographically smaller id in A.
function orderedPair(userIdA, userIdB) {
  return userIdA < userIdB
    ? { participantAId: userIdA, participantBId: userIdB }
    : { participantAId: userIdB, participantBId: userIdA };
}

function shapeCollab(collab) {
  if (!collab) return collab;
  return {
    id: collab.id,
    senderId: collab.senderId,
    receiverId: collab.receiverId,
    postId: collab.postId,
    message: collab.message,
    status: collab.status,
    respondedAt: collab.respondedAt,
    createdAt: collab.createdAt,
    updatedAt: collab.updatedAt,
    sender: collab.sender,
    receiver: collab.receiver,
    post: collab.post,
  };
}

async function createCollaboration(senderId, { receiverId, postId = null, message = null }) {
  if (senderId === receiverId) {
    throw ApiError.badRequest('You cannot send a collaboration request to yourself');
  }

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) throw ApiError.notFound('Recipient user not found');

  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || !post.isActive) throw ApiError.notFound('Post not found');
    if (post.userId !== receiverId) {
      throw ApiError.badRequest('Post does not belong to the specified recipient');
    }
  }

  // Prevent duplicate PENDING requests for the same (sender, receiver, post).
  // Prisma findUnique can't take null on a composite unique field, so use findFirst.
  const existing = await prisma.collaboration.findFirst({
    where: { senderId, receiverId, postId: postId || null },
  });
  if (existing && existing.status === 'PENDING') {
    throw ApiError.conflict('A pending request already exists for this recipient');
  }
  if (existing && existing.status === 'ACCEPTED') {
    throw ApiError.conflict('You already have an active collaboration with this user');
  }

  const collab = existing
    ? await prisma.collaboration.update({
        where: { id: existing.id },
        data: {
          message: message || null,
          status: 'PENDING',
          respondedAt: null,
        },
        include: { sender: userInclude, receiver: userInclude, post: postInclude },
      })
    : await prisma.collaboration.create({
        data: { senderId, receiverId, postId: postId || null, message: message || null },
        include: { sender: userInclude, receiver: userInclude, post: postInclude },
      });

  return shapeCollab(collab);
}

async function listCollaborations(userId, { direction = 'incoming', status } = {}) {
  const where = {};
  if (direction === 'incoming') where.receiverId = userId;
  else if (direction === 'outgoing') where.senderId = userId;
  else where.OR = [{ receiverId: userId }, { senderId: userId }];

  if (status) where.status = status;

  const items = await prisma.collaboration.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { sender: userInclude, receiver: userInclude, post: postInclude },
  });
  return items.map(shapeCollab);
}

async function respondToCollaboration(userId, collabId, action) {
  const collab = await prisma.collaboration.findUnique({ where: { id: collabId } });
  if (!collab) throw ApiError.notFound('Collaboration request not found');
  if (collab.receiverId !== userId) throw ApiError.forbidden('Only the recipient can respond');
  if (collab.status !== 'PENDING') {
    throw ApiError.badRequest(`Request is already ${collab.status.toLowerCase()}`);
  }

  const nextStatus = action === 'ACCEPT' ? 'ACCEPTED' : action === 'DECLINE' ? 'DECLINED' : null;
  if (!nextStatus) throw ApiError.badRequest('Invalid action');

  const updated = await prisma.$transaction(async (tx) => {
    const updatedCollab = await tx.collaboration.update({
      where: { id: collabId },
      data: { status: nextStatus, respondedAt: new Date() },
      include: { sender: userInclude, receiver: userInclude, post: postInclude },
    });

    if (nextStatus === 'ACCEPTED') {
      const pair = orderedPair(collab.senderId, collab.receiverId);
      const existingConv = await tx.conversation.findUnique({
        where: {
          participantAId_participantBId: pair,
        },
      });

      if (existingConv) {
        if (!existingConv.collaborationId) {
          await tx.conversation.update({
            where: { id: existingConv.id },
            data: { collaborationId: collabId },
          });
        }
      } else {
        await tx.conversation.create({
          data: { ...pair, collaborationId: collabId },
        });
      }
    }

    return updatedCollab;
  });

  return shapeCollab(updated);
}

async function cancelCollaboration(userId, collabId) {
  const collab = await prisma.collaboration.findUnique({ where: { id: collabId } });
  if (!collab) throw ApiError.notFound('Collaboration request not found');
  if (collab.senderId !== userId) throw ApiError.forbidden('Only the sender can cancel');
  if (collab.status !== 'PENDING') {
    throw ApiError.badRequest('Only pending requests can be cancelled');
  }
  const updated = await prisma.collaboration.update({
    where: { id: collabId },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  });
  return shapeCollab(updated);
}

/**
 * Most-recent collab between me and another user (either direction). Used by
 * the profile screen to pick the right CollabAction state.
 */
async function getCollaborationWith(userId, otherUserId) {
  if (userId === otherUserId) return null;
  const collab = await prisma.collaboration.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: { sender: userInclude, receiver: userInclude, post: postInclude },
  });
  return collab ? shapeCollab(collab) : null;
}

module.exports = {
  createCollaboration,
  listCollaborations,
  respondToCollaboration,
  cancelCollaboration,
  getCollaborationWith,
};
