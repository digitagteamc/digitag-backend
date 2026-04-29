const { prisma } = require('../../config/db');
const { OPPOSITE_FEED_ROLE } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const { buildPostInclude, shapePost } = require('../posts/post.service');

async function getFeed(user, query = {}) {
  const { skip, take, page, limit } = parsePagination(query);

  const targetRoles = OPPOSITE_FEED_ROLE[user.role] || [];

  const where = {
    isActive: true,
    role: { in: targetRoles },
  };

  if (query.collaborationType) where.collaborationType = query.collaborationType;
  if (query.location) where.location = { contains: query.location, mode: 'insensitive' };
  if (query.search) where.description = { contains: query.search, mode: 'insensitive' };
  if (query.categoryId) {
    where.OR = [
      { user: { creatorProfile: { categoryId: query.categoryId } } },
      { user: { freelancerProfile: { categoryId: query.categoryId } } },
    ];
  }

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

module.exports = { getFeed };
