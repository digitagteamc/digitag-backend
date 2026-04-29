const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(4000).required(),
});

const openWithSchema = Joi.object({
  userId: uuid.required(),
});

const listMessagesQuery = Joi.object({
  cursor: uuid.optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
}).unknown(true);

module.exports = { sendMessageSchema, openWithSchema, listMessagesQuery };
