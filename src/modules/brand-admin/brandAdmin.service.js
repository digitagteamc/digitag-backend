const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const push = require('../../services/push/push.service');
const logger = require('../../utils/logger');

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function emptyToNull(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = v === '' ? null : v;
  return out;
}

async function uniqueSlug(model, base, excludeId) {
  const root = slugify(base) || 'item';
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await prisma[model].findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

async function logActivity(admin, action, target) {
  await prisma.adminActivityLog
    .create({ data: { adminId: admin.id, adminName: admin.name, action, target } })
    .catch(() => {});
}

async function paginate(model, { where, orderBy, query, select, include }) {
  const { skip, take, page, limit } = parsePagination(query);
  const [items, total] = await Promise.all([
    prisma[model].findMany({ where, orderBy, skip, take, ...(select ? { select } : {}), ...(include ? { include } : {}) }),
    prisma[model].count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

// -------------------------
// Brands — KYC approval (/admin/brands)
// -------------------------

const brandSelect = {
  id: true, userId: true, name: true, email: true, pan: true, gstin: true, city: true, state: true,
  website: true, industry: true, tagId: true, approvalStatus: true, rejectionReason: true,
  reviewedAt: true, reviewedBy: true, createdAt: true,
  user: { select: { id: true, mobileNumber: true, countryCode: true, createdAt: true } },
};

function listBrands(query = {}) {
  const where = { user: { status: { not: 'DELETED' } } };
  if (query.status) where.approvalStatus = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { pan: { contains: query.search, mode: 'insensitive' } },
      { gstin: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  // Pending queue reads oldest first (FIFO review); everything else newest first.
  const orderBy = { createdAt: query.status === 'PENDING' ? 'asc' : 'desc' };
  return paginate('brandProfile', { where, orderBy, query, select: brandSelect });
}

async function getBrand(id) {
  const brand = await prisma.brandProfile.findUnique({ where: { id }, select: brandSelect });
  if (!brand) throw ApiError.notFound('Brand not found');
  return brand;
}

async function reviewBrand(admin, id, decision, reason = null) {
  const brand = await prisma.brandProfile.findUnique({ where: { id }, select: { id: true, userId: true, name: true, approvalStatus: true } });
  if (!brand) throw ApiError.notFound('Brand not found');
  if (brand.approvalStatus !== 'PENDING') {
    throw ApiError.conflict(`This brand is already ${brand.approvalStatus.toLowerCase()}`);
  }

  // Conditional on still being PENDING so two admins can't both act on it.
  const { count } = await prisma.brandProfile.updateMany({
    where: { id, approvalStatus: 'PENDING' },
    data: {
      approvalStatus: decision,
      rejectionReason: decision === 'REJECTED' ? reason || null : null,
      reviewedAt: new Date(),
      reviewedBy: admin.name,
    },
  });
  if (count === 0) throw ApiError.conflict('This brand was just reviewed by another admin');

  await logActivity(admin, decision === 'APPROVED' ? 'Approved brand' : 'Rejected brand', brand.name || id);

  const copy = decision === 'APPROVED'
    ? { title: 'Brand approved 🎉', body: `${brand.name || 'Your brand'} is verified. You can now post requirements and send ad requests.` }
    : { title: 'Brand registration not approved', body: reason || 'Please review your details and resubmit.' };
  push
    .sendToUser(brand.userId, (t) =>
      push.notificationMessage(t, { type: decision === 'APPROVED' ? 'BRAND_APPROVED' : 'BRAND_REJECTED' }, copy),
    )
    .catch((err) => logger.error('[FCM] brand review push failed', { err: err.message }));

  return { ok: true };
}

// -------------------------
// Channels (/admin/youtube-channels, /admin/channels)
// -------------------------

const channelListInclude = { _count: { select: { catalogItems: true, adRequests: true, users: true } } };

function listChannels(query = {}, { type } = {}) {
  const where = {};
  const t = type || query.type;
  if (t) where.type = t;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  return paginate('mediaChannel', {
    where,
    orderBy: [{ subscriberCount: 'desc' }, { createdAt: 'desc' }],
    query,
    include: channelListInclude,
  });
}

async function getChannel(id) {
  const channel = await prisma.mediaChannel.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
      _count: { select: { catalogItems: true, adRequests: true } },
    },
  });
  if (!channel) throw ApiError.notFound('Channel not found');
  return channel;
}

async function createChannel(admin, data, { type } = {}) {
  const { owner, ...fields } = emptyToNull(data);
  if (owner) {
    const exists = await prisma.channelUser.findUnique({ where: { email: owner.email.toLowerCase() } });
    if (exists) throw ApiError.conflict('A CRM account with this email already exists');
  }
  const channel = await prisma.mediaChannel.create({
    data: {
      ...fields,
      ...(type ? { type } : {}),
      slug: await uniqueSlug('mediaChannel', fields.slug || fields.name),
      ...(owner
        ? {
            users: {
              create: {
                name: owner.name,
                email: owner.email.toLowerCase(),
                passwordHash: await bcrypt.hash(owner.password, 12),
                role: 'OWNER',
              },
            },
          }
        : {}),
    },
    include: channelListInclude,
  });
  await logActivity(admin, 'Created channel', channel.name);
  return channel;
}

async function updateChannel(admin, id, data, { type } = {}) {
  const existing = await prisma.mediaChannel.findUnique({ where: { id } });
  if (!existing || (type && existing.type !== type)) throw ApiError.notFound('Channel not found');
  const clean = emptyToNull(data);
  if (clean.slug) clean.slug = await uniqueSlug('mediaChannel', clean.slug, id);
  const channel = await prisma.mediaChannel.update({ where: { id }, data: clean, include: channelListInclude });
  await logActivity(admin, 'Updated channel', existing.name);
  return channel;
}

const channelUserSelect = { id: true, name: true, email: true, role: true, isActive: true, channelId: true, lastLoginAt: true };

async function createChannelUser(admin, channelId, { name, email, password, role }) {
  const channel = await prisma.mediaChannel.findUnique({ where: { id: channelId }, select: { id: true, name: true } });
  if (!channel) throw ApiError.notFound('Channel not found');
  const exists = await prisma.channelUser.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) throw ApiError.conflict('A CRM account with this email already exists');
  const user = await prisma.channelUser.create({
    data: { channelId, name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: role || 'OWNER' },
    select: channelUserSelect,
  });
  await logActivity(admin, 'Created channel CRM login', `${channel.name} — ${user.email}`);
  return user;
}

async function updateChannelUser(admin, channelId, userId, data) {
  const user = await prisma.channelUser.findFirst({ where: { id: userId, channelId } });
  if (!user) throw ApiError.notFound('CRM user not found');
  const { password, ...rest } = data;
  const updated = await prisma.channelUser.update({
    where: { id: userId },
    data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select: channelUserSelect,
  });
  await logActivity(admin, 'Updated channel CRM login', updated.email);
  return updated;
}

// -------------------------
// Ad types (/admin/ad-types)
// -------------------------

function listAdTypes(query = {}) {
  const where = {};
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  return paginate('adType', { where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], query });
}

async function createAdType(admin, data) {
  const clean = emptyToNull(data);
  const exists = await prisma.adType.findFirst({ where: { name: { equals: clean.name, mode: 'insensitive' } } });
  if (exists) throw ApiError.conflict('An ad type with this name already exists');
  const adType = await prisma.adType.create({ data: { ...clean, slug: await uniqueSlug('adType', clean.name) } });
  await logActivity(admin, 'Created ad type', adType.name);
  return adType;
}

async function updateAdType(admin, id, data) {
  const existing = await prisma.adType.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Ad type not found');
  const clean = emptyToNull(data);
  if (clean.name && clean.name.toLowerCase() !== existing.name.toLowerCase()) {
    const clash = await prisma.adType.findFirst({ where: { name: { equals: clean.name, mode: 'insensitive' }, NOT: { id } } });
    if (clash) throw ApiError.conflict('An ad type with this name already exists');
  }
  const adType = await prisma.adType.update({ where: { id }, data: clean });
  await logActivity(admin, 'Updated ad type', adType.name);
  return adType;
}

// -------------------------
// Celebrities (/admin/celebrities)
// -------------------------

function listCelebrities(query = {}) {
  const where = {};
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  return paginate('celebrity', { where, orderBy: [{ followerCount: 'desc' }, { createdAt: 'desc' }], query });
}

async function createCelebrity(admin, data) {
  const celebrity = await prisma.celebrity.create({ data: emptyToNull(data) });
  await logActivity(admin, 'Created celebrity', celebrity.name);
  return celebrity;
}

async function updateCelebrity(admin, id, data) {
  const existing = await prisma.celebrity.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Celebrity not found');
  const celebrity = await prisma.celebrity.update({ where: { id }, data: emptyToNull(data) });
  await logActivity(admin, 'Updated celebrity', celebrity.name);
  return celebrity;
}

// -------------------------
// Ad requests oversight (/admin/ad-requests)
// -------------------------

function listAdRequests(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.channelId) where.channelId = query.channelId;
  return paginate('adRequest', {
    where,
    orderBy: { createdAt: 'desc' },
    query,
    include: {
      channel: { select: { id: true, name: true, type: true } },
      brand: { select: { id: true, mobileNumber: true, brandProfile: { select: { name: true } } } },
      _count: { select: { items: true } },
    },
  });
}

module.exports = {
  listBrands,
  getBrand,
  reviewBrand,
  listChannels,
  getChannel,
  createChannel,
  updateChannel,
  createChannelUser,
  updateChannelUser,
  listAdTypes,
  createAdType,
  updateAdType,
  listCelebrities,
  createCelebrity,
  updateCelebrity,
  listAdRequests,
};
