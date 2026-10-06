const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const push = require('../../services/push/push.service');
const logger = require('../../utils/logger');
const { publicChannelSelect } = require('../channels/channel.service');
const { assertApprovedBrand } = require('../brands/brandApproval');

// Who may move a request from which status to which. Brands can only pull a
// request back before the channel has committed to it; everything after that
// is the channel's call from the CRM.
const TRANSITIONS = {
  BRAND: {
    PENDING: ['CANCELLED'],
    UNDER_REVIEW: ['CANCELLED'],
  },
  CHANNEL: {
    PENDING: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'],
    UNDER_REVIEW: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['IN_PROGRESS', 'COMPLETED'],
    IN_PROGRESS: ['COMPLETED'],
  },
};

// Brand-facing push copy per status the channel moves a request into.
const STATUS_PUSH = {
  UNDER_REVIEW: (ch) => ({ title: 'Ad request under review', body: `${ch} is reviewing your ad request` }),
  ACCEPTED: (ch) => ({ title: 'Ad request accepted', body: `${ch} accepted your ad request` }),
  REJECTED: (ch) => ({ title: 'Ad request declined', body: `${ch} declined your ad request` }),
  IN_PROGRESS: (ch) => ({ title: 'Your ad is live', body: `${ch} started running your campaign` }),
  COMPLETED: (ch) => ({ title: 'Campaign completed', body: `${ch} marked your campaign as completed` }),
};

const brandSelect = {
  id: true,
  mobileNumber: true,
  brandProfile: {
    select: {
      name: true, profilePicture: true, email: true, contactPerson: true, contactDesignation: true,
      industry: true, website: true, city: true, state: true, pan: true, gstin: true,
    },
  },
};

function detailInclude({ forChannel = false } = {}) {
  return {
    channel: { select: publicChannelSelect },
    items: { orderBy: { createdAt: 'asc' } },
    events: { orderBy: { createdAt: 'asc' } },
    // The channel needs the brand's contact details to work the deal; the
    // brand already knows its own.
    ...(forChannel ? { brand: { select: brandSelect } } : {}),
  };
}

function listInclude({ forChannel = false } = {}) {
  return {
    channel: { select: { id: true, name: true, type: true, logoUrl: true } },
    _count: { select: { items: true } },
    ...(forChannel ? { brand: { select: { id: true, brandProfile: { select: { name: true, profilePicture: true, industry: true } } } } } : {}),
  };
}

function shape(request) {
  if (!request) return request;
  const { brand, ...rest } = request;
  if (!brand) return rest;
  const { brandProfile, ...brandRest } = brand;
  return { ...rest, brand: { ...brandRest, ...(brandProfile || {}) } };
}

// -------------------------
// Brand side
// -------------------------

async function createAdRequest(user, data) {
  await assertApprovedBrand(user.id);
  const profile = await prisma.brandProfile.findUnique({ where: { userId: user.id }, select: { name: true } });

  const channel = await prisma.mediaChannel.findFirst({
    where: { id: data.channelId, isActive: true },
    select: { id: true, name: true },
  });
  if (!channel) throw ApiError.notFound('Channel not found');

  const ids = data.items.map((i) => i.catalogItemId);
  const catalog = await prisma.channelCatalogItem.findMany({
    where: { id: { in: ids }, channelId: channel.id, isActive: true, adType: { isActive: true } },
    include: { adType: { select: { name: true } } },
  });
  const byId = new Map(catalog.map((c) => [c.id, c]));

  let total = new Prisma.Decimal(0);
  const currencies = new Set();
  const items = data.items.map((line) => {
    const item = byId.get(line.catalogItemId);
    if (!item) throw ApiError.badRequest('One or more selected catalog items are no longer available');
    if (line.quantity < item.minQuantity) {
      throw ApiError.badRequest(`"${item.name}" needs a minimum quantity of ${item.minQuantity}`);
    }
    const lineTotal = item.price.mul(line.quantity);
    total = total.add(lineTotal);
    currencies.add(item.currency);
    return {
      catalogItemId: item.id,
      adTypeName: item.adType.name,
      itemName: item.name,
      unit: item.unit,
      unitPrice: item.price,
      quantity: line.quantity,
      lineTotal,
      notes: line.notes || null,
    };
  });
  if (currencies.size > 1) throw ApiError.badRequest('Selected items are priced in different currencies');

  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    throw ApiError.badRequest('endDate must be on or after startDate');
  }

  const created = await prisma.adRequest.create({
    data: {
      brandUserId: user.id,
      channelId: channel.id,
      campaignName: data.campaignName || null,
      brief: data.brief || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      budget: data.budget ?? null,
      totalAmount: total,
      currency: [...currencies][0] || 'INR',
      items: { create: items },
      events: {
        create: { actor: 'BRAND', actorId: user.id, actorName: profile.name, toStatus: 'PENDING', note: data.brief || null },
      },
    },
    include: detailInclude(),
  });
  return shape(created);
}

async function listMyAdRequests(user, query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const where = { brandUserId: user.id };
  if (query.status) where.status = query.status;
  if (query.channelId) where.channelId = query.channelId;
  const [items, total] = await Promise.all([
    prisma.adRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: listInclude() }),
    prisma.adRequest.count({ where }),
  ]);
  return { items: items.map(shape), meta: buildPaginationMeta({ total, page, limit }) };
}

async function getMyAdRequest(user, id) {
  const request = await prisma.adRequest.findFirst({ where: { id, brandUserId: user.id }, include: detailInclude() });
  if (!request) throw ApiError.notFound('Ad request not found');
  return shape(request);
}

async function brandName(userId) {
  const p = await prisma.brandProfile.findUnique({ where: { userId }, select: { name: true } });
  return p?.name || null;
}

async function cancelByBrand(user, id, note) {
  const request = await prisma.adRequest.findFirst({ where: { id, brandUserId: user.id }, select: { id: true } });
  if (!request) throw ApiError.notFound('Ad request not found');
  await transition(id, { actor: 'BRAND', actorId: user.id, actorName: await brandName(user.id), toStatus: 'CANCELLED', note });
  return getMyAdRequest(user, id);
}

async function addBrandNote(user, id, note) {
  const request = await prisma.adRequest.findFirst({ where: { id, brandUserId: user.id }, select: { id: true } });
  if (!request) throw ApiError.notFound('Ad request not found');
  await prisma.adRequestEvent.create({
    data: { requestId: id, actor: 'BRAND', actorId: user.id, actorName: await brandName(user.id), note },
  });
  return getMyAdRequest(user, id);
}

// -------------------------
// Shared status machine (brand + CRM)
// -------------------------

/** Moves a request to `toStatus` if the actor is allowed to from its current
 *  status. The update is conditional on the status we read, so two CRM users
 *  acting at once can't both "win" — the loser gets a 409. */
async function transition(requestId, { actor, actorId = null, actorName = null, toStatus, note = null }) {
  const current = await prisma.adRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, brandUserId: true, channel: { select: { name: true } } },
  });
  if (!current) throw ApiError.notFound('Ad request not found');

  const allowed = TRANSITIONS[actor]?.[current.status] || [];
  if (!allowed.includes(toStatus)) {
    throw ApiError.badRequest(`Cannot move a ${current.status.toLowerCase()} request to ${toStatus.toLowerCase()}`);
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.adRequest.updateMany({
      where: { id: requestId, status: current.status },
      data: {
        status: toStatus,
        ...(actor === 'CHANNEL' && note ? { channelNote: note } : {}),
        // respondedAt = when the channel made its accept/reject decision.
        ...(toStatus === 'ACCEPTED' || toStatus === 'REJECTED' ? { respondedAt: new Date() } : {}),
      },
    });
    if (count === 0) throw ApiError.conflict('This request was updated by someone else. Refresh and try again.');
    await tx.adRequestEvent.create({
      data: { requestId, actor, actorId, actorName, fromStatus: current.status, toStatus, note },
    });
  });

  if (actor === 'CHANNEL' && STATUS_PUSH[toStatus]) {
    const copy = STATUS_PUSH[toStatus](current.channel.name);
    push
      .sendToUser(current.brandUserId, (t) =>
        push.notificationMessage(t, { type: 'AD_REQUEST_UPDATE', adRequestId: requestId, status: toStatus }, copy),
      )
      .catch((err) => logger.error('[FCM] ad request push failed', { err: err.message }));
  }
}

module.exports = {
  TRANSITIONS,
  createAdRequest,
  listMyAdRequests,
  getMyAdRequest,
  cancelByBrand,
  addBrandNote,
  transition,
  detailInclude,
  listInclude,
  shape,
};
