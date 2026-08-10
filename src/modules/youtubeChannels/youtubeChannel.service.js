const { buildCatalogService } = require('../_shared/catalogService');

module.exports = buildCatalogService({
  model: 'youtubeChannel',
  cacheKeyPrefix: 'youtubeChannels',
  notFoundMessage: 'YouTube channel not found',
  orderBy: { subscriberCount: 'desc' },
});
