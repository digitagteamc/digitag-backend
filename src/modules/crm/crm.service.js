const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/db');
const env = require('../../config/env');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const adRequestService = require('../ad-requests/adRequest.service');
const { catalogItemSelect } = require('../channels/channel.service');

const CRM_TOKEN_TTL = '12h';

function signChannelToken(channelUser) {
  return jwt.sign({ sub: channelUser.id, role: 'CHANNEL', type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: CRM_TOKEN_TTL,
  });
}

const channelSelect = {
  id: true, name: true, slug: true, type: true, description: true, logoUrl: true, languages: true,
  region: true, subscriberCount: true, category: true, websiteUrl: true, contactEmail: true, contactPhone: true,
  isActive: true, isVerified: true,
};

function emptyToNull(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = v === '' ? null : v;
  return out;
}

function shapeChannelUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt, channelId: u.channelId };
}

// -------------------------
// Auth / account
// -------------------------

async function login({ email, password }) {
  const user = await prisma.channelUser.findUnique({
    where: { email: email.toLowerCase() },
    include: { channel: { select: channelSelect } },
  });
  // Same message for unknown email and wrong password — no account probing.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('CRM account is inactive');
  if (!user.channel.isActive) throw ApiError.forbidden('This channel is currently disabled');

  const updated = await prisma.channelUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { token: signChannelToken(user), user: shapeChannelUser(updated), channel: user.channel };
}

async function getMe(channelUser) {
  const [user, channel] = await Promise.all([
    prisma.channelUser.findUnique({ where: { id: channelUser.id } }),
    prisma.mediaChannel.findUnique({ where: { id: channelUser.channelId }, select: channelSelect }),
  ]);
  return { user: shapeChannelUser(user), channel };
}

async function changePassword(channelUser, { currentPassword, newPassword }) {
  const user = await prisma.channelUser.findUnique({ where: { id: channelUser.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  await prisma.channelUser.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
}

async function updateChannel(channelUser, data) {
  return prisma.mediaChannel.update({ where: { id: channelUser.channelId }, data: emptyToNull(data), select: channelSelect });
}

// -------------------------
// Team (owner only)
// -------------------------

async function listTeam(channelUser) {
  const users = await prisma.channelUser.findMany({ where: { channelId: channelUser.channelId }, orderBy: { createdAt: 'asc' } });
  return users.map(shapeChannelUser);
}

async function createTeamMember(channelUser, { name, email, password, role }) {
  const exists = await prisma.channelUser.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) throw ApiError.conflict('A CRM account with this email already exists');
  const created = await prisma.channelUser.create({
    data: {
      channelId: channelUser.channelId,
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: role || 'MANAGER',
    },
  });
  return shapeChannelUser(created);
}

async function updateTeamMember(channelUser, id, data) {
  const member = await prisma.channelUser.findFirst({ where: { id, channelId: channelUser.channelId } });
  if (!member) throw ApiError.notFound('Team member not found');
  if (id === channelUser.id && (data.isActive === false || data.role === 'MANAGER')) {
    throw ApiError.badRequest('You cannot deactivate or demote yourself');
  }
  const updated = await prisma.channelUser.update({ where: { id }, data });
  return shapeChannelUser(updated);
}

// -------------------------
// Ad requests inbox
// -------------------------

async function listAdRequests(channelUser, query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const where = { channelId: channelUser.channelId };
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }
  if (query.search) {
    where.OR = [
      { campaignName: { contains: query.search, mode: 'insensitive' } },
      { brief: { contains: query.search, mode: 'insensitive' } },
      { brand: { brandProfile: { name: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.adRequest.findMany({
      where,
      orderBy: { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' },
      skip,
      take,
      include: adRequestService.listInclude({ forChannel: true }),
    }),
    prisma.adRequest.count({ where }),
  ]);
  return { items: items.map(adRequestService.shape), meta: buildPaginationMeta({ total, page, limit }) };
}

async function getAdRequest(channelUser, id) {
  const request = await prisma.adRequest.findFirst({
    where: { id, channelId: channelUser.channelId },
    include: adRequestService.detailInclude({ forChannel: true }),
  });
  if (!request) throw ApiError.notFound('Ad request not found');
  return {
    ...adRequestService.shape(request),
    allowedTransitions: adRequestService.TRANSITIONS.CHANNEL[request.status] || [],
  };
}

async function assertOwnRequest(channelUser, id) {
  const exists = await prisma.adRequest.findFirst({ where: { id, channelId: channelUser.channelId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Ad request not found');
}

async function updateAdRequestStatus(channelUser, id, { status, note }) {
  await assertOwnRequest(channelUser, id);
  await adRequestService.transition(id, {
    actor: 'CHANNEL', actorId: channelUser.id, actorName: channelUser.name, toStatus: status, note: note || null,
  });
  return getAdRequest(channelUser, id);
}

async function addNote(channelUser, id, note) {
  await assertOwnRequest(channelUser, id);
  await prisma.$transaction([
    prisma.adRequestEvent.create({
      data: { requestId: id, actor: 'CHANNEL', actorId: channelUser.id, actorName: channelUser.name, note },
    }),
    prisma.adRequest.update({ where: { id }, data: { channelNote: note } }),
  ]);
  return getAdRequest(channelUser, id);
}

async function getStats(channelUser) {
  const where = { channelId: channelUser.channelId };
  const [byStatus, acceptedValue, catalogCount] = await Promise.all([
    prisma.adRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.adRequest.aggregate({
      where: { ...where, status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] } },
      _sum: { totalAmount: true },
    }),
    prisma.channelCatalogItem.count({ where: { channelId: channelUser.channelId, isActive: true } }),
  ]);
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
  return {
    requests: counts,
    totalRequests: byStatus.reduce((n, r) => n + r._count._all, 0),
    bookedValue: acceptedValue._sum.totalAmount || '0',
    activeCatalogItems: catalogCount,
  };
}

// -------------------------
// Catalog (rate card)
// -------------------------

async function assertActiveAdType(adTypeId) {
  const adType = await prisma.adType.findFirst({ where: { id: adTypeId, isActive: true }, select: { id: true } });
  if (!adType) throw ApiError.badRequest('Unknown ad type');
}

async function listAdTypesForChannel() {
  return prisma.adType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, iconUrl: true, accentColor: true, description: true },
  });
}

async function listCatalog(channelUser, { adTypeId, includeInactive } = {}) {
  const where = { channelId: channelUser.channelId };
  if (adTypeId) where.adTypeId = adTypeId;
  if (!includeInactive) where.isActive = true;
  return prisma.channelCatalogItem.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { ...catalogItemSelect, isActive: true, createdAt: true, updatedAt: true },
  });
}

async function createCatalogItem(channelUser, data) {
  await assertActiveAdType(data.adTypeId);
  return prisma.channelCatalogItem.create({
    data: { ...emptyToNull(data), channelId: channelUser.channelId },
    select: { ...catalogItemSelect, isActive: true },
  });
}

async function updateCatalogItem(channelUser, id, data) {
  const item = await prisma.channelCatalogItem.findFirst({ where: { id, channelId: channelUser.channelId } });
  if (!item) throw ApiError.notFound('Catalog item not found');
  if (data.adTypeId) await assertActiveAdType(data.adTypeId);
  // Existing requests keep their own price snapshot, so editing is safe.
  return prisma.channelCatalogItem.update({ where: { id }, data: emptyToNull(data), select: { ...catalogItemSelect, isActive: true } });
}

async function archiveCatalogItem(channelUser, id) {
  const item = await prisma.channelCatalogItem.findFirst({ where: { id, channelId: channelUser.channelId } });
  if (!item) throw ApiError.notFound('Catalog item not found');
  // Soft delete — past requests still link to it.
  await prisma.channelCatalogItem.update({ where: { id }, data: { isActive: false } });
}

module.exports = {
  login,
  getMe,
  changePassword,
  updateChannel,
  listTeam,
  createTeamMember,
  updateTeamMember,
  listAdRequests,
  getAdRequest,
  updateAdRequestStatus,
  addNote,
  getStats,
  listAdTypesForChannel,
  listCatalog,
  createCatalogItem,
  updateCatalogItem,
  archiveCatalogItem,
};
