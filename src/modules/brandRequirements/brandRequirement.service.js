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
  const [rawItems, total] = await Promise.all([
    prisma.brandRequirement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { collaborations: true } } },
    }),
    prisma.brandRequirement.count({ where }),
  ]);
  const items = rawItems.map(({ _count, ...r }) => ({ ...r, pitchCount: _count.collaborations }));
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

const brandUserInclude = {
  select: {
    id: true,
    brandProfile: { select: { name: true, profilePicture: true } },
  },
};

/** "Opportunities For You" — Creator/Freelancer-facing browse of open Brand
 *  requirements. category/location are free-text contains-matches supplied
 *  by the client (same convention as follow.service.js's listSuggestions),
 *  not auto-inferred server-side, since BrandRequirement.category is loose
 *  text rather than a Category id a profile's categories[] could join against. */
async function listOpenRequirements(userId, query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = { status: 'ACTIVE' };
  if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
  if (query.targetType) where.targetType = query.targetType;

  const [items, total] = await Promise.all([
    prisma.brandRequirement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { brandUser: brandUserInclude },
    }),
    prisma.brandRequirement.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

/** Requirement detail — increments viewCount on each fetch by a Creator/
 *  Freelancer (not the posting Brand themselves, so a Brand re-checking
 *  their own post doesn't inflate its own view count). */
async function getRequirementById(userId, id) {
  const requirement = await prisma.brandRequirement.findUnique({
    where: { id },
    include: { brandUser: brandUserInclude },
  });
  if (!requirement) throw ApiError.notFound('Requirement not found');

  if (requirement.brandUserId !== userId) {
    await prisma.brandRequirement.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    requirement.viewCount += 1;
  }
  return requirement;
}

module.exports = { createRequirement, listMyRequirements, listOpenRequirements, getRequirementById };
