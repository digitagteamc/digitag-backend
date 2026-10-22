const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { ROLES } = require('../../constants/roles');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const postService = require('../posts/post.service');

// The app's "Who are you looking for?" requirements, stored as brand posts so
// they share the creator feed, Collab requests (postId) and applicant flow.
// CREATORS requirements go to Creators (and Freelancers when the brand ticks
// freelancersCanSee); AGENCIES ones to Freelancers too.

const brandUserSelect = {
  select: { id: true, brandProfile: { select: { name: true, profilePicture: true } } },
};

// Older brand posts have no requirementTarget — they count as CREATORS.
// (A bare NOT would drop them: NULL never satisfies NOT (col = 'AGENCIES').)
const creatorTargetWhere = { OR: [{ requirementTarget: null }, { requirementTarget: { not: 'AGENCIES' } }] };

function shapeRequirement(post, pitchCount) {
  return {
    id: post.id,
    brandUserId: post.userId,
    targetType: post.requirementTarget || 'CREATORS',
    freelancersCanSee: post.targetRoles.includes(ROLES.FREELANCER),
    category: post.category,
    creatorCountMin: post.creatorCountMin,
    creatorCountMax: post.creatorCountMax,
    genderPreference: post.genderPreference,
    deliverables: post.deliverables,
    visibility: post.visibility,
    message: post.description || null,
    status: post.status === 'OPEN' ? 'ACTIVE' : post.status,
    viewCount: post.viewCount,
    ...(pitchCount !== undefined && { pitchCount }),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    brandUser: post.user,
  };
}

async function createRequirement(user, data) {
  if (user.role !== ROLES.BRAND) throw ApiError.forbidden('Only brand accounts can post a requirement');
  const post = await postService.createPost(user, {
    description: data.message || '',
    category: data.category || null,
    freelancerRequired: data.targetType === 'AGENCIES' || data.freelancersCanSee === true,
    requirementTarget: data.targetType || 'CREATORS',
    creatorCountMin: data.creatorCountMin,
    creatorCountMax: data.creatorCountMax,
    genderPreference: data.genderPreference,
    deliverables: data.deliverables,
    visibility: data.visibility,
  });
  const row = await prisma.post.findUnique({ where: { id: post.id }, include: { user: brandUserSelect } });
  return shapeRequirement(row, 0);
}

async function listMyRequirements(user, query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = { userId: user.id, role: ROLES.BRAND, isActive: true };
  if (query.targetType === 'AGENCIES') where.requirementTarget = 'AGENCIES';
  else if (query.targetType === 'CREATORS') where.AND = [creatorTargetWhere];

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: brandUserSelect, _count: { select: { collaborations: true } } },
    }),
    prisma.post.count({ where }),
  ]);
  return {
    items: posts.map((p) => shapeRequirement(p, p._count.collaborations)),
    meta: buildPaginationMeta({ total, page, limit }),
  };
}

/** "Opportunities For You" — open brand requirements visible to my role. */
async function listOpenRequirements(user, query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    role: ROLES.BRAND,
    targetRoles: { has: user.role },
    isActive: true,
    isHidden: false,
    status: 'OPEN',
    user: { status: 'ACTIVE' },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
  if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
  if (query.targetType === 'AGENCIES') where.requirementTarget = 'AGENCIES';
  else if (query.targetType === 'CREATORS') where.AND = [creatorTargetWhere];

  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
    select: { blockerId: true, blockedId: true },
  });
  if (blocks.length) {
    where.userId = { notIn: blocks.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId)) };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { user: brandUserSelect } }),
    prisma.post.count({ where }),
  ]);
  // My own interest in each — so the app shows "Interested" instead of
  // offering a second request the backend would reject as a duplicate.
  const mine = posts.length
    ? await prisma.collaboration.findMany({
        where: { senderId: user.id, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true, status: true },
      })
    : [];
  const myStatusByPost = new Map(mine.map((c) => [c.postId, c.status]));
  return {
    items: posts.map((p) => ({ ...shapeRequirement(p), myInterestStatus: myStatusByPost.get(p.id) || null })),
    meta: buildPaginationMeta({ total, page, limit }),
  };
}

/** Detail — counts a view unless the posting brand is looking at its own. */
async function getRequirementById(user, id) {
  const post = await prisma.post.findUnique({ where: { id }, include: { user: brandUserSelect } });
  if (!post || !post.isActive || post.role !== ROLES.BRAND) throw ApiError.notFound('Requirement not found');

  if (post.userId !== user.id) {
    if (post.isHidden || post.status === 'CLOSED' || !post.targetRoles.includes(user.role)) {
      throw ApiError.notFound('Requirement not found');
    }
    await prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    post.viewCount += 1;
  }
  return shapeRequirement(post);
}

module.exports = { createRequirement, listMyRequirements, listOpenRequirements, getRequirementById };
