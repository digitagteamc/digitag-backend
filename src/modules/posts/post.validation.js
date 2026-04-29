const Joi = require('joi');
const { url, pagination, idParam } = require('../../validations/common.validation');

const COLLAB_TYPES = ['PAID', 'UNPAID'];

const createPostSchema = Joi.object({
  description: Joi.string().trim().min(1).max(2000).required(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  collaborationType: Joi.string().valid(...COLLAB_TYPES).default('UNPAID'),
  imageUrl: url.allow('', null).optional(),
  imageKey: Joi.string().allow('', null).optional(),
});

const updatePostSchema = Joi.object({
  description: Joi.string().trim().min(1).max(2000).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  collaborationType: Joi.string().valid(...COLLAB_TYPES).optional(),
  imageUrl: url.allow('', null).optional(),
  imageKey: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const listQuery = pagination.keys({
  collaborationType: Joi.string().valid(...COLLAB_TYPES).optional(),
  location: Joi.string().trim().max(120).optional(),
  search: Joi.string().trim().max(120).optional(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  listQuery,
  idParam,
};
