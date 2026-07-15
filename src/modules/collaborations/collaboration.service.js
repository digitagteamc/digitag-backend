const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const push = require('../../services/push/push.service');
const { assertNotBlocked } = require('../blocks/block.service');

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    fcmToken: true,
    isPremium: true,
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

// Premium perk: free accounts get a limited number of outgoing collaboration
// requests per calendar month (resets on the 1st); Premium is unlimited.
const FREE_COLLAB_REQUESTS_PER_MONTH = 10;

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
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

/** Free-tier monthly collab-request quota. Returns limit: null for Premium
 *  (unlimited) so the mobile app can render "Unlimited" instead of a count. */
async function getCollabRequestQuota(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPremium: true } });
  if (user?.isPremium) return { used: 0, limit: null, remaining: null };
  const used = await prisma.collaboration.count({
    where: { senderId: userId, createdAt: { gte: startOfCurrentMonth() } },
  });
  return { used, limit: FREE_COLLAB_REQUESTS_PER_MONTH, remaining: Math.max(FREE_COLLAB_REQUESTS_PER_MONTH - used, 0) };
}

async function createCollaboration(senderId, { receiverId, postId = null, message = null }, senderRole) {
  if (senderId === receiverId) {
    throw ApiError.badRequest('You cannot send a collaboration request to yourself');
  }
  await assertNotBlocked(senderId, receiverId);

  const quota = await getCollabRequestQuota(senderId);
  if (quota.limit !== null && quota.used >= quota.limit) {
    throw ApiError.forbidden(
      `You've reached your monthly limit of ${FREE_COLLAB_REQUESTS_PER_MONTH} collaboration requests. Upgrade to Premium for unlimited requests.`,
    );
  }

  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) throw ApiError.notFound('Recipient user not found');

  const allowedReceiverRoles = OPPOSITE_FEED_ROLE[senderRole] || [];
  if (!allowedReceiverRoles.includes(receiver.role)) {
    throw ApiError.forbidden('You can only collaborate with users of a different role');
  }

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

  const senderName = collab.sender?.creatorProfile?.name || collab.sender?.freelancerProfile?.name || 'Someone';
  await push.sendToUser(receiverId, (t) =>
    push.notificationMessage(
      t,
      { type: 'COLLAB_REQUEST', collabId: collab.id },
      { title: 'New Collaboration Request', body: `${senderName} wants to collaborate with you` },
    ),
  );

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

  // COMPLETE action: only the creator party can mark work as done
  if (action === 'COMPLETE') {
    const isParty = collab.senderId === userId || collab.receiverId === userId;
    if (!isParty) throw ApiError.forbidden('You are not part of this collaboration');
    if (collab.status !== 'ACCEPTED') {
      throw ApiError.badRequest('Only accepted collaborations can be marked complete');
    }
    const caller = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (caller?.role !== 'CREATOR') throw ApiError.forbidden('Only a Creator can mark collaboration as complete');

    const updated = await prisma.collaboration.update({
      where: { id: collabId },
      data: { status: 'COMPLETED', respondedAt: new Date() },
      include: { sender: userInclude, receiver: userInclude, post: postInclude },
    });

    // Tell the other party their work was marked done — same pattern as the
    // accept/decline notifications, and persists to the Notifications tab.
    const iAmSender = updated.senderId === userId;
    const otherPartyId = iAmSender ? updated.receiverId : updated.senderId;
    const completer = iAmSender ? updated.sender : updated.receiver;
    const completerName = completer?.creatorProfile?.name || completer?.freelancerProfile?.name || 'Someone';
    await push.sendToUser(otherPartyId, (t) =>
      push.notificationMessage(
        t,
        { type: 'COLLAB_COMPLETED', collabId: updated.id },
        { title: 'Collaboration Completed', body: `${completerName} marked your collaboration as complete` },
      ),
    );

    return shapeCollab(updated);
  }

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
        // Always re-point at the newly accepted collab: a conversation left
        // linked to an old COMPLETED collab would stay locked forever even
        // though the pair just started a fresh collaboration.
        if (existingConv.collaborationId !== collabId) {
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

  const responderName = updated.receiver?.creatorProfile?.name || updated.receiver?.freelancerProfile?.name || 'Someone';
  const notifBody = nextStatus === 'ACCEPTED'
    ? `${responderName} accepted your collaboration request`
    : `${responderName} declined your collaboration request`;
  await push.sendToUser(updated.senderId, (t) =>
    push.notificationMessage(
      t,
      { type: nextStatus === 'ACCEPTED' ? 'COLLAB_ACCEPTED' : 'COLLAB_DECLINED', collabId: updated.id },
      { title: nextStatus === 'ACCEPTED' ? 'Collaboration Accepted!' : 'Collaboration Declined', body: notifBody },
    ),
  );

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
  getCollabRequestQuota,
};
