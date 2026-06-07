const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const cache = require('../../services/cache/cache.service');

const CATEGORIES_TTL = 10 * 60; // 10 minutes

async function listCategories({ role, search, onlyActive = true } = {}) {
  const cacheKey = `categories:${role || 'all'}:${search || ''}:${onlyActive}`;

  return cache.wrap(cacheKey, CATEGORIES_TTL, async () => {
    const where = {};
    if (onlyActive) where.isActive = true;
    if (role) where.applicableRoles = { has: role };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    return prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        applicableRoles: true,
      },
    });
  });
}

async function getCategoryById(id) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

module.exports = { listCategories, getCategoryById };
