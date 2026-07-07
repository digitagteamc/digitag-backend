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
  status: Joi.string().valid('pending', 'active', 'cancelled', 'completed').optional(),
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

const blockListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const categoryListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().trim().max(200).optional().allow(''),
});

const ROLE_VALUES = ['CREATOR', 'FREELANCER', 'BRAND', 'AGENCY'];

const createCategory = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).min(1).max(100).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  applicableRoles: Joi.array().items(Joi.string().valid(...ROLE_VALUES)).min(1).required(),
});

const updateCategory = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).min(1).max(100).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  applicableRoles: Joi.array().items(Joi.string().valid(...ROLE_VALUES)).min(1).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

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
  blockListQuery,
  categoryListQuery,
  createCategory,
  updateCategory,
};
