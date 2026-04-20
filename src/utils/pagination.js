function parsePagination(query = {}, defaults = {}) {
  const pageRaw = parseInt(query.page, 10);
  const limitRaw = parseInt(query.limit, 10);

  const defaultLimit = defaults.limit ?? 20;
  const maxLimit = defaults.maxLimit ?? 100;

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  let limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

function buildPaginationMeta({ total, page, limit }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = { parsePagination, buildPaginationMeta };
