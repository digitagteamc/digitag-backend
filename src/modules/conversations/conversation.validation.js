const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(4000).optional().allow(''),
  imageUrl: Joi.string().uri().max(2000).optional(),
  // One-time location pin — always sent as a pair.
  locationLat: Joi.number().min(-90).max(90).optional(),
  locationLng: Joi.number().min(-180).max(180).optional(),
  replyToId: uuid.optional(),
}).and('locationLat', 'locationLng').or('content', 'imageUrl', 'locationLat');

const editMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(4000).required(),
});

const reactMessageSchema = Joi.object({
  emoji: Joi.string().trim().min(1).max(8).required(),
});

const openWithSchema = Joi.object({
  userId: uuid.required(),
});

const listMessagesQuery = Joi.object({
  cursor: uuid.optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
}).unknown(true);

module.exports = { sendMessageSchema, editMessageSchema, reactMessageSchema, openWithSchema, listMessagesQuery };
