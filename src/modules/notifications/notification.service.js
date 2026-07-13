const { prisma } = require('../../config/db');

async function listNotifications(userId, { cursor, limit = 30 } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);

  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return {
    items,
    nextCursor: items.length === take ? items[items.length - 1].id : null,
  };
}

async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { success: true };
}

async function unreadCount(userId) {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { count };
}

module.exports = { listNotifications, markAllRead, unreadCount };
