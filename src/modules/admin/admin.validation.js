const Joi = require('joi');

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(200).optional().allow(''),
  role: Joi.string().valid('CREATOR', 'FREELANCER', 'BRAND', 'AGENCY').optional(),
  status: Joi.string().valid('active', 'suspended').optional(),
});

const postListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(200).optional().allow(''),
  role: Joi.string().valid('CREATOR', 'FREELANCER').optional(),
  status: Joi.string().valid('active', 'hidden', 'deleted', 'reported').optional(),
});

const collabListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'active', 'cancelled').optional(),
});

const reportListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'reviewed', 'dismissed').optional(),
  type: Joi.string().valid('USER', 'POST').optional(),
});

const statsQuery = Joi.object({
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
});

const reviewReport = Joi.object({
  status: Joi.string().valid('reviewed', 'dismissed').required(),
});

const idParam = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = {
  login,
  listQuery,
  postListQuery,
  collabListQuery,
  reportListQuery,
  statsQuery,
  reviewReport,
  idParam,
};
