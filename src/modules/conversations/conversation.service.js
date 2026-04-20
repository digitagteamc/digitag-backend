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

function orderedPair(userIdA, userIdB) {
  return userIdA < userIdB
    ? { participantAId: userIdA, participantBId: userIdB }
    : { participantAId: userIdB, participantBId: userIdA };
}

function shapeParticipant(user) {
  if (!user) return null;
  const profile = user.creatorProfile || user.freelancerProfile;
  return {
    id: user.id,
    role: user.role,
    name: profile ? profile.name : null,
    profilePicture: profile ? profile.profilePicture : null,
    location: profile ? profile.location : null,
  };
}

async function listConversations(userId) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ participantAId: userId }, { participantBId: userId }] },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      participantA: userInclude,
      participantB: userInclude,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true, isRead: true },
      },
    },
  });

  const items = await Promise.all(
    rows.map(async (c) => {
      const other = c.participantAId === userId ? c.participantB : c.participantA;
      const lastMessage = c.messages[0] || null;

      const unreadCount = await prisma.message.count({
        where: { conversationId: c.id, senderId: { not: userId }, isRead: false },
      });

      return {
        id: c.id,
        collaborationId: c.collaborationId,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        other: shapeParticipant(other),
        lastMessage,
        unreadCount,
      };
    }),
  );

  return items;
}

async function getConversationById(userId, id) {
  const c = await prisma.conversation.findUnique({
    where: { id },
    include: { participantA: userInclude, participantB: userInclude },
  });
  if (!c) throw ApiError.notFound('Conversation not found');
  if (c.participantAId !== userId && c.participantBId !== userId) {
    throw ApiError.forbidden('Not a participant in this conversation');
  }
  const other = c.participantAId === userId ? c.participantB : c.participantA;
  return {
    id: c.id,
    collaborationId: c.collaborationId,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    other: shapeParticipant(other),
  };
}

async function listMessages(userId, conversationId, { cursor, limit = 50 } = {}) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw ApiError.notFound('Conversation not found');
  if (conv.participantAId !== userId && conv.participantBId !== userId) {
    throw ApiError.forbidden('Not a participant in this conversation');
  }

  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  // Mark incoming messages as read on fetch.
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  });

  return {
    items: messages.reverse(),
    nextCursor: messages.length === take ? messages[0].id : null,
  };
}

async function sendMessage(userId, conversationId, content) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { collaboration: true },
  });
  if (!conv) throw ApiError.notFound('Conversation not found');
  if (conv.participantAId !== userId && conv.participantBId !== userId) {
    throw ApiError.forbidden('Not a participant in this conversation');
  }
  if (conv.collaboration && conv.collaboration.status !== 'ACCEPTED') {
    throw ApiError.forbidden('Messaging is unlocked only after the collaboration is accepted');
  }
  const trimmed = String(content || '').trim();
  if (!trimmed) throw ApiError.badRequest('Message content is required');

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: userId, content: trimmed },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
  ]);

  return message;
}

/** Open-or-create a conversation with another user — only if an accepted
 * collaboration already exists between the two. */
async function openConversationWith(userId, otherUserId) {
  if (userId === otherUserId) throw ApiError.badRequest('Cannot converse with yourself');

  const pair = orderedPair(userId, otherUserId);
  const existing = await prisma.conversation.findUnique({
    where: { participantAId_participantBId: pair },
    include: { participantA: userInclude, participantB: userInclude },
  });

  if (existing) {
    const other = existing.participantAId === userId ? existing.participantB : existing.participantA;
    return {
      id: existing.id,
      collaborationId: existing.collaborationId,
      createdAt: existing.createdAt,
      lastMessageAt: existing.lastMessageAt,
      other: shapeParticipant(other),
    };
  }

  // No prior conversation — require an accepted collab in either direction.
  const acceptedCollab = await prisma.collaboration.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
  });
  if (!acceptedCollab) {
    throw ApiError.forbidden('You must have an accepted collaboration to start a conversation');
  }

  const created = await prisma.conversation.create({
    data: { ...pair, collaborationId: acceptedCollab.id },
    include: { participantA: userInclude, participantB: userInclude },
  });
  const other = created.participantAId === userId ? created.participantB : created.participantA;
  return {
    id: created.id,
    collaborationId: created.collaborationId,
    createdAt: created.createdAt,
    lastMessageAt: created.lastMessageAt,
    other: shapeParticipant(other),
  };
}

module.exports = {
  listConversations,
  getConversationById,
  listMessages,
  sendMessage,
  openConversationWith,
};
