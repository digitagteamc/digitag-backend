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

// Profiles store `categories` as raw Category-table UUIDs (multi-select), not
// slugs/names. Every place that displays a profile's categories needs those
// UUIDs resolved first. Takes a flat list of ids (possibly with duplicates/
// nulls) and returns a Map<id, {id,slug,name}> in a single batched query.
async function resolveCategoryMap(categoryIds) {
  const unique = Array.from(new Set((categoryIds || []).filter(Boolean)));
  if (!unique.length) return new Map();
  const rows = await prisma.category.findMany({
    where: { id: { in: unique } },
    select: { id: true, slug: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

module.exports = { listCategories, getCategoryById, resolveCategoryMap };
