const { buildCatalogService } = require('../_shared/catalogService');

module.exports = buildCatalogService({
  model: 'celebrity',
  cacheKeyPrefix: 'celebrities',
  notFoundMessage: 'Celebrity not found',
  orderBy: { followerCount: 'desc' },
});
