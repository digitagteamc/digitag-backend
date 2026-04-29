const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

async function listCategories({ role, search, onlyActive = true } = {}) {
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
}

async function getCategoryById(id) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

module.exports = { listCategories, getCategoryById };
