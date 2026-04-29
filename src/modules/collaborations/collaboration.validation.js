const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const createSchema = Joi.object({
  receiverId: uuid.required(),
  postId: uuid.optional(),
  message: Joi.string().trim().max(1000).allow('', null).optional(),
});

const respondSchema = Joi.object({
  action: Joi.string().valid('ACCEPT', 'DECLINE').required(),
});

const listQuery = Joi.object({
  direction: Joi.string().valid('incoming', 'outgoing', 'all').optional(),
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED').optional(),
}).unknown(true);

module.exports = { createSchema, respondSchema, listQuery };
