const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const cache = require('../../services/cache/cache.service');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

const CATALOG_TTL = 10 * 60; // 10 minutes — same as categories

/**
 * Factory for a simple admin-curated catalog (YoutubeChannel, AdType,
 * Celebrity): public cached list + getById, admin paginated list + create +
 * update. Same shape and split as category.service.js (public module) +
 * admin.service.js (write side) combined into one, since these catalogs are
 * small enough not to need that separation.
 */
function buildCatalogService({ model, cacheKeyPrefix, notFoundMessage, orderBy = { createdAt: 'desc' } }) {
  function delegate() {
    return prisma[model];
  }

  async function list({ search, onlyActive = true } = {}) {
    const cacheKey = `${cacheKeyPrefix}:${search || ''}:${onlyActive}`;
    return cache.wrap(cacheKey, CATALOG_TTL, async () => {
      const where = {};
      if (onlyActive) where.isActive = true;
      if (search) where.name = { contains: search, mode: 'insensitive' };
      return delegate().findMany({ where, orderBy });
    });
  }

  async function getById(id) {
    const row = await delegate().findUnique({ where: { id } });
    if (!row) throw ApiError.notFound(notFoundMessage);
    return row;
  }

  async function adminList(query = {}) {
    const { page, limit, skip, take } = parsePagination(query);
    const where = {};
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const [items, total] = await Promise.all([
      delegate().findMany({ where, skip, take, orderBy }),
      delegate().count({ where }),
    ]);
    return { items, meta: buildPaginationMeta({ total, page, limit }) };
  }

  async function adminCreate(data) {
    const row = await delegate().create({ data });
    await cache.delPattern(`${cacheKeyPrefix}:*`);
    return row;
  }

  async function adminUpdate(id, data) {
    const existing = await delegate().findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound(notFoundMessage);
    const row = await delegate().update({ where: { id }, data });
    await cache.delPattern(`${cacheKeyPrefix}:*`);
    return row;
  }

  return { list, getById, adminList, adminCreate, adminUpdate };
}

module.exports = { buildCatalogService };
