const { buildCatalogService } = require('../_shared/catalogService');

module.exports = buildCatalogService({
  model: 'adType',
  cacheKeyPrefix: 'adTypes',
  notFoundMessage: 'Ad type not found',
  orderBy: { sortOrder: 'asc' },
});
