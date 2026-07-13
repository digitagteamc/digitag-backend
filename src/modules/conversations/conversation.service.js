const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const cache = require('../../services/cache/cache.service');
const push = require('../../services/push/push.service');

const CONVERSATIONS_TTL = 30; // seconds

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    fcmToken: true,
    lastLoginAt: true,
    lastActiveAt: true,
    showOnlineStatus: true,
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
  // Privacy Settings > Show Online Status: when off, hide the timestamps the
  // chat UI uses to render "online"/"last seen" for this person.
  const hideActivity = user.showOnlineStatus === false;
  return {
    id: user.id,
    role: user.role,
    name: profile ? profile.name : null,
    profilePicture: profile ? profile.profilePicture : null,
    location: profile ? profile.location : null,
    lastLoginAt: hideActivity ? null : (user.lastLoginAt || null),
    lastActiveAt: hideActivity ? null : (user.lastActiveAt || null),
  };
}

async function listConversations(userId) {
  const cacheKey = `conversations:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const [rows, unreadGroups] = await Promise.all([
    prisma.conversation.findMany({
      where: { OR: [{ participantAId: userId }, { participantBId: userId }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        participantA: userInclude,
        participantB: userInclude,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, imageUrl: true, isDeleted: true, senderId: true, createdAt: true, isRead: true },
        },
      },
    }),
    // Single aggregation query instead of one COUNT per conversation
    prisma.message.groupBy({
      by: ['conversationId'],
      where: { senderId: { not: userId }, isRead: false },
      _count: { id: true },
    }),
  ]);

  const unreadMap = new Map(unreadGroups.map((g) => [g.conversationId, g._count.id]));

  const result = rows.map((c) => {
    const other = c.participantAId === userId ? c.participantB : c.participantA;
    return {
      id: c.id,
      collaborationId: c.collaborationId,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      other: shapeParticipant(other),
      lastMessage: c.messages[0] || null,
      unreadCount: unreadMap.get(c.id) || 0,
    };
  });

  await cache.set(cacheKey, result, CONVERSATIONS_TTL);
  return result;
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

/** Call history between this conversation's two participants, for rendering
 *  inline in the chat thread — a call can happen from a profile/feed screen
 *  before either side ever opens the chat, so it's looked up by participant
 *  pair rather than requiring a conversationId on Call itself. */
async function getCallHistory(userId, conversationId) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw ApiError.notFound('Conversation not found');
  if (conv.participantAId !== userId && conv.participantBId !== userId) {
    throw ApiError.forbidden('Not a participant in this conversation');
  }

  const { participantAId, participantBId } = conv;
  return prisma.call.findMany({
    where: {
      OR: [
        { callerId: participantAId, calleeId: participantBId },
        { callerId: participantBId, calleeId: participantAId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      callerId: true,
      calleeId: true,
      status: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
    },
  });
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
    include: { replyTo: { select: { id: true, content: true, imageUrl: true, senderId: true, isDeleted: true } } },
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

async function sendMessage(userId, conversationId, content, imageUrl = null, replyToId = null, locationLat = null, locationLng = null) {
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
  const hasLocation = locationLat != null && locationLng != null;
  if (!trimmed && !imageUrl && !hasLocation) throw ApiError.badRequest('Message content, image, or location is required');

  // A reply may only quote a message from this same conversation.
  if (replyToId) {
    const quoted = await prisma.message.findUnique({ where: { id: replyToId }, select: { conversationId: true } });
    if (!quoted || quoted.conversationId !== conversationId) replyToId = null;
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId, senderId: userId, content: trimmed || '', imageUrl: imageUrl || null, replyToId,
        locationLat: hasLocation ? locationLat : null,
        locationLng: hasLocation ? locationLng : null,
      },
      include: { replyTo: { select: { id: true, content: true, imageUrl: true, senderId: true, isDeleted: true } } },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
  ]);

  // Push to every device the recipient is logged in on.
  const otherUserId = conv.participantAId === userId ? conv.participantBId : conv.participantAId;
  const senderUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { creatorProfile: { select: { name: true } }, freelancerProfile: { select: { name: true } } },
  });
  const senderName = senderUser?.creatorProfile?.name || senderUser?.freelancerProfile?.name || 'Someone';
  await push.sendToUser(otherUserId, (t) =>
    push.notificationMessage(
      t,
      { type: 'NEW_MESSAGE', conversationId, messageId: message.id },
      { title: senderName, body: trimmed || (hasLocation ? '📍 Location' : '📷 Image') },
    ),
  );

  // Bust conversation list cache for both participants
  await Promise.all([
    cache.del(`conversations:${userId}`),
    cache.del(`conversations:${otherUserId}`),
  ]);

  return message;
}

async function editMessage(userId, conversationId, messageId, content) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw ApiError.notFound('Message not found');
  if (msg.senderId !== userId) throw ApiError.forbidden('Cannot edit another user\'s message');
  if (msg.conversationId !== conversationId) throw ApiError.forbidden('Message not in this conversation');
  const trimmed = String(content || '').trim();
  if (!trimmed) throw ApiError.badRequest('Edited content cannot be empty');
  return prisma.message.update({
    where: { id: messageId },
    data: { content: trimmed, isEdited: true },
  });
}

/** Toggle the caller's reaction to a message — either participant may react,
 * not just the sender, so this checks conversation membership rather than
 * senderId the way edit/delete do. */
async function toggleReaction(userId, conversationId, messageId, emoji) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw ApiError.notFound('Message not found');
  if (msg.conversationId !== conversationId) throw ApiError.forbidden('Message not in this conversation');

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || (conv.participantAId !== userId && conv.participantBId !== userId)) {
    throw ApiError.forbidden('Not a participant in this conversation');
  }

  const reactions = { ...(msg.reactions || {}) };
  const users = new Set(reactions[emoji] || []);
  if (users.has(userId)) users.delete(userId);
  else users.add(userId);

  if (users.size > 0) reactions[emoji] = [...users];
  else delete reactions[emoji];

  return prisma.message.update({
    where: { id: messageId },
    data: { reactions },
    select: { id: true, reactions: true },
  });
}

/** WhatsApp-style "delete for everyone" — keeps the row (so ordering/read-state stays
 * intact) but clears the content and flips isDeleted so clients render a placeholder. */
async function deleteMessage(userId, conversationId, messageId) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw ApiError.notFound('Message not found');
  if (msg.senderId !== userId) throw ApiError.forbidden('Cannot delete another user\'s message');
  if (msg.conversationId !== conversationId) throw ApiError.forbidden('Message not in this conversation');
  return prisma.message.update({
    where: { id: messageId },
    data: { content: '', imageUrl: null, isDeleted: true },
  });
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
  editMessage,
  toggleReaction,
  deleteMessage,
  openConversationWith,
  getCallHistory,
};
