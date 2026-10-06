const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

const publicChannelSelect = {
  id: true,
  name: true,
  slug: true,
  type: true,
  description: true,
  logoUrl: true,
  languages: true,
  region: true,
  subscriberCount: true,
  category: true,
  websiteUrl: true,
  isVerified: true,
};

const catalogItemSelect = {
  id: true,
  channelId: true,
  name: true,
  description: true,
  unit: true,
  price: true,
  currency: true,
  minQuantity: true,
  slot: true,
  durationSeconds: true,
  mediaUrl: true,
  sortOrder: true,
  adType: { select: { id: true, name: true, iconUrl: true, accentColor: true } },
};

/** Ad types offered by each channel (from its active catalog), with item
 *  count and starting price per type — one grouped query for many channels. */
async function adTypeSummaryByChannel(channelIds) {
  if (!channelIds.length) return new Map();
  const rows = await prisma.channelCatalogItem.groupBy({
    by: ['channelId', 'adTypeId'],
    where: { channelId: { in: channelIds }, isActive: true, adType: { isActive: true } },
    _count: { _all: true },
    _min: { price: true },
  });
  const adTypes = await prisma.adType.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.adTypeId))] } },
    select: { id: true, name: true, slug: true, sortOrder: true },
  });
  const adTypeById = new Map(adTypes.map((a) => [a.id, a]));

  const byChannel = new Map();
  for (const r of rows) {
    const adType = adTypeById.get(r.adTypeId);
    if (!adType) continue;
    if (!byChannel.has(r.channelId)) byChannel.set(r.channelId, []);
    byChannel.get(r.channelId).push({
      id: adType.id,
      name: adType.name,
      slug: adType.slug,
      sortOrder: adType.sortOrder,
      itemCount: r._count._all,
      startingPrice: r._min.price,
    });
  }
  for (const list of byChannel.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return byChannel;
}

function startingPrice(adTypes) {
  let min = null;
  for (const a of adTypes) if (a.startingPrice !== null && (min === null || a.startingPrice.lt(min))) min = a.startingPrice;
  return min;
}

async function listChannels(query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const where = { isActive: true };
  if (query.type) where.type = query.type;
  if (query.language) where.languages = { has: query.language };
  if (query.region) where.region = { contains: query.region, mode: 'insensitive' };
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  // Only channels that actually offer this ad type.
  if (query.adTypeId) where.catalogItems = { some: { adTypeId: query.adTypeId, isActive: true } };

  const [channels, total] = await Promise.all([
    prisma.mediaChannel.findMany({
      where,
      orderBy: [{ subscriberCount: 'desc' }, { name: 'asc' }],
      skip,
      take,
      select: publicChannelSelect,
    }),
    prisma.mediaChannel.count({ where }),
  ]);

  const summary = await adTypeSummaryByChannel(channels.map((c) => c.id));
  return {
    items: channels.map((c) => {
      const adTypes = summary.get(c.id) || [];
      return { ...c, adTypes, startingPrice: startingPrice(adTypes) };
    }),
    meta: buildPaginationMeta({ total, page, limit }),
  };
}

async function getChannel(id) {
  const channel = await prisma.mediaChannel.findFirst({ where: { id, isActive: true }, select: publicChannelSelect });
  if (!channel) throw ApiError.notFound('Channel not found');
  const adTypes = (await adTypeSummaryByChannel([id])).get(id) || [];
  return { ...channel, adTypes, startingPrice: startingPrice(adTypes) };
}

async function getCatalog(channelId, { adTypeId } = {}) {
  const channel = await prisma.mediaChannel.findFirst({ where: { id: channelId, isActive: true }, select: { id: true } });
  if (!channel) throw ApiError.notFound('Channel not found');
  const where = { channelId, isActive: true, adType: { isActive: true } };
  if (adTypeId) where.adTypeId = adTypeId;
  return prisma.channelCatalogItem.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    select: catalogItemSelect,
  });
}

async function listAdTypes() {
  return prisma.adType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, iconUrl: true, accentColor: true, description: true },
  });
}

module.exports = { listChannels, getChannel, getCatalog, listAdTypes, catalogItemSelect, publicChannelSelect };
