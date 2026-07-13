/**
 * One-time script: reconstruct Notification rows for activity that happened
 * before the Notification table existed (collab requests/accepts/declines,
 * new-post pushes to accepted collaborators) so the app's Notifications tab
 * isn't empty for existing users. Messages are NOT backfilled here — chat
 * has its own dedicated history/unread tracking, and duplicating it into
 * the generic Notifications tab was decided against (see push.service.js's
 * SKIP_NOTIFICATION_PERSIST).
 *
 * Only backfills events strictly before the earliest real (post-launch)
 * Notification row, so nothing here can duplicate a row push.service.js
 * already created live. Backfilled rows are marked isRead: true — these are
 * things the user already saw through the app's existing screens (chat,
 * collab requests) before this feature existed, not new unread activity.
 *
 * Run: node scripts/backfill-notifications.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const profileInclude = {
  select: {
    id: true, role: true,
    creatorProfile: { select: { name: true } },
    freelancerProfile: { select: { name: true } },
  },
};

function displayName(user) {
  const profile = user?.creatorProfile || user?.freelancerProfile;
  if (profile?.name) return profile.name;
  return user?.role === 'FREELANCER' ? 'Freelancer' : 'Creator';
}

async function backfillCollabs(cutoff) {
  const collabs = await prisma.collaboration.findMany({
    include: { sender: profileInclude, receiver: profileInclude },
  });

  const rows = [];
  for (const c of collabs) {
    const senderName = displayName(c.sender);
    const receiverName = displayName(c.receiver);

    if (c.createdAt < cutoff) {
      rows.push({
        userId: c.receiverId,
        type: 'COLLAB_REQUEST',
        title: 'New Collaboration Request',
        body: `${senderName} wants to collaborate with you`,
        data: { type: 'COLLAB_REQUEST', collabId: c.id },
        isRead: true,
        createdAt: c.createdAt,
      });
    }

    if ((c.status === 'ACCEPTED' || c.status === 'DECLINED') && c.respondedAt && c.respondedAt < cutoff) {
      const accepted = c.status === 'ACCEPTED';
      rows.push({
        userId: c.senderId,
        type: accepted ? 'COLLAB_ACCEPTED' : 'COLLAB_DECLINED',
        title: accepted ? 'Collaboration Accepted!' : 'Collaboration Declined',
        body: accepted
          ? `${receiverName} accepted your collaboration request`
          : `${receiverName} declined your collaboration request`,
        data: { type: accepted ? 'COLLAB_ACCEPTED' : 'COLLAB_DECLINED', collabId: c.id },
        isRead: true,
        createdAt: c.respondedAt,
      });
    }
  }

  if (rows.length) await prisma.notification.createMany({ data: rows });
  return rows.length;
}

async function backfillPosts(cutoff) {
  const posts = await prisma.post.findMany({
    where: { createdAt: { lt: cutoff } },
    include: { user: profileInclude },
  });

  const rows = [];
  for (const post of posts) {
    // Approximation: uses CURRENT accepted collaborators, not who was
    // accepted at the moment the post went up (that history isn't kept).
    // Fine at this scale — collaboration acceptance is effectively terminal.
    const collabs = await prisma.collaboration.findMany({
      where: { status: 'ACCEPTED', OR: [{ senderId: post.userId }, { receiverId: post.userId }] },
      select: { senderId: true, receiverId: true },
    });
    const posterName = displayName(post.user);
    const preview = post.description ? post.description.slice(0, 60) : 'Check out my new post';

    for (const c of collabs) {
      const otherId = c.senderId === post.userId ? c.receiverId : c.senderId;
      rows.push({
        userId: otherId,
        type: 'NEW_POST',
        title: `${posterName} posted`,
        body: preview,
        data: { type: 'NEW_POST', postId: post.id },
        isRead: true,
        createdAt: post.createdAt,
      });
    }
  }

  if (rows.length) await prisma.notification.createMany({ data: rows });
  return rows.length;
}

(async () => {
  const earliest = await prisma.notification.findFirst({ orderBy: { createdAt: 'asc' } });
  const cutoff = earliest ? earliest.createdAt : new Date();
  console.log(`Backfilling notifications created before ${cutoff.toISOString()}...`);

  const collabCount = await backfillCollabs(cutoff);
  const postCount = await backfillPosts(cutoff);

  console.log({ collabCount, postCount, total: collabCount + postCount });
  await prisma.$disconnect();
})();
