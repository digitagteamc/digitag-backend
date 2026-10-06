const Joi = require('joi');
const { uuid, pagination } = require('../../validations/common.validation');

const CHANNEL_TYPES = ['TV', 'YOUTUBE', 'RADIO', 'OTT', 'PRINT', 'DIGITAL', 'OTHER'];

const listQuery = pagination.keys({
  type: Joi.string().valid(...CHANNEL_TYPES).optional(),
  category: Joi.string().trim().max(100).optional(),
  adTypeId: uuid.optional(),
  language: Joi.string().trim().max(50).optional(),
  region: Joi.string().trim().max(120).optional(),
  search: Joi.string().trim().max(120).optional(),
});

const catalogQuery = Joi.object({
  adTypeId: uuid.optional(),
}).unknown(true);

module.exports = { CHANNEL_TYPES, listQuery, catalogQuery };
