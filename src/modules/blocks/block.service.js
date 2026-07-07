const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const cache = require('../../services/cache/cache.service');

const userInclude = {
  select: {
    id: true,
    role: true,
    mobileNumber: true,
    creatorProfile: { select: { name: true, profilePicture: true, location: true, bio: true } },
    freelancerProfile: { select: { name: true, profilePicture: true, location: true, bio: true } },
  },
};

function shapeUser(u) {
  if (!u) return null;
  const profile = u.creatorProfile || u.freelancerProfile;
  return {
    id: u.id,
    role: u.role,
    name: profile ? profile.name : null,
    profilePicture: profile ? profile.profilePicture : null,
    location: profile ? profile.location : null,
    bio: profile ? profile.bio : null,
  };
}

async function block(blockerId, blockedId) {
  if (blockerId === blockedId) throw ApiError.badRequest('Cannot block yourself');

  const [other, existing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: blockedId },
      select: { creatorProfile: { select: { name: true } }, freelancerProfile: { select: { name: true } } },
    }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } }),
  ]);
  if (!other) throw ApiError.notFound('User not found');

  if (!existing) {
    const blockerProfile = await prisma.user.findUnique({
      where: { id: blockerId },
      select: { creatorProfile: { select: { name: true } }, freelancerProfile: { select: { name: true } } },
    });
    const blockerName = blockerProfile?.creatorProfile?.name || blockerProfile?.freelancerProfile?.name || 'A user';
    const blockedName = other.creatorProfile?.name || other.freelancerProfile?.name || blockedId;

    await Promise.all([
      prisma.block.create({ data: { blockerId, blockedId } }),
      // Surface the block in the existing admin Reports queue instantly so the
      // developer can review/eject within the required 24h window.
      prisma.report.create({
        data: {
          type: 'USER',
          targetId: blockedId,
          targetName: blockedName,
          reason: `Blocked by ${blockerName}`,
          reportedBy: blockerId,
        },
      }),
    ]);
  }

  // Blocked user's posts must disappear from the blocker's feed instantly.
  await cache.delPattern(`feed:${blockerId}:*`);

  return { blocked: true };
}

async function unblock(blockerId, blockedId) {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
  await cache.delPattern(`feed:${blockerId}:*`);
  return { unblocked: true };
}

async function listBlocked(blockerId) {
  const rows = await prisma.block.findMany({
    where: { blockerId },
    include: { blocked: userInclude },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => shapeUser(r.blocked));
}

async function status(blockerId, blockedId) {
  const row = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return { isBlocked: !!row };
}

module.exports = { block, unblock, listBlocked, status };
