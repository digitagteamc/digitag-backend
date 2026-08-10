const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ROLES } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const { assertBrandApproved } = require('../brands/brand.service');

async function ensureBrandUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== ROLES.BRAND) throw ApiError.forbidden('Only brand accounts can post a requirement');
  return user;
}

async function createRequirement(userId, data) {
  const user = await ensureBrandUser(userId);
  await assertBrandApproved(userId, user.role);

  return prisma.brandRequirement.create({
    data: {
      brandUserId: userId,
      targetType: data.targetType || 'CREATORS',
      category: data.category || null,
      creatorCountMin: data.creatorCountMin ?? null,
      creatorCountMax: data.creatorCountMax ?? null,
      genderPreference: data.genderPreference || null,
      deliverables: data.deliverables || null,
      visibility: data.visibility || null,
      message: data.message || null,
    },
  });
}

async function listMyRequirements(userId, query = {}) {
  await ensureBrandUser(userId);
  const { page, limit, skip, take } = parsePagination(query);
  const where = { brandUserId: userId };
  const [items, total] = await Promise.all([
    prisma.brandRequirement.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.brandRequirement.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

module.exports = { createRequirement, listMyRequirements };
