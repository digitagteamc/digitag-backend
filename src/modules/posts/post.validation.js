const Joi = require('joi');
const { url, pagination, idParam } = require('../../validations/common.validation');

const COLLAB_TYPES = ['PAID', 'UNPAID'];
// Matches the durations offered in the app's Boost Duration picker. Omitting
// this entirely (the user's choice not to boost) means the post never expires.
const BOOST_HOURS = [4, 12, 24, 48];
// Brand requirement posts only — ignored for Creator/Freelancer posts.
// CREATOR is always added server-side; send FREELANCER for "freelancer required".
const TARGET_ROLES = ['CREATOR', 'FREELANCER'];
const brandFields = {
  title: Joi.string().trim().max(150).allow('', null).optional(),
  // .single(): multipart forms may send one plain value instead of an array.
  targetRoles: Joi.array().items(Joi.string().valid(...TARGET_ROLES)).single().unique().max(2).optional(),
  // Same thing as a checkbox — true adds FREELANCER to targetRoles.
  freelancerRequired: Joi.boolean().optional(),
};

const createPostSchema = Joi.object({
  description: Joi.string().trim().min(1).max(2000).required(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  collaborationType: Joi.string().valid(...COLLAB_TYPES).default('UNPAID'),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  budget: Joi.string().trim().max(100).allow('', null).optional(),
  imageUrl: url.allow('', null).optional(),
  imageKey: Joi.string().allow('', null).optional(),
  boostHours: Joi.number().valid(...BOOST_HOURS).optional(),
  ...brandFields,
});

const updatePostSchema = Joi.object({
  description: Joi.string().trim().min(1).max(2000).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  collaborationType: Joi.string().valid(...COLLAB_TYPES).optional(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  budget: Joi.string().trim().max(100).allow('', null).optional(),
  imageUrl: url.allow('', null).optional(),
  imageKey: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  boostHours: Joi.number().valid(...BOOST_HOURS).allow(null).optional(),
  ...brandFields,
}).min(1);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('OPEN', 'COMPLETED', 'CLOSED').required(),
});

const listQuery = pagination.keys({
  collaborationType: Joi.string().valid(...COLLAB_TYPES).optional(),
  location: Joi.string().trim().max(120).optional(),
  search: Joi.string().trim().max(120).optional(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  updateStatusSchema,
  listQuery,
  idParam,
};
