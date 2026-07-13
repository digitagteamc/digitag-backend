const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const listQuery = Joi.object({
  cursor: uuid.optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
}).unknown(true);

module.exports = { listQuery };
