const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(200).optional().allow(''),
  role: Joi.string().valid('CREATOR', 'FREELANCER', 'BRAND', 'AGENCY').optional(),
  status: Joi.string().valid('active', 'suspended', 'deleted').optional(),
});

const postListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(200).optional().allow(''),
  role: Joi.string().valid('CREATOR', 'FREELANCER').optional(),
  status: Joi.string().valid('active', 'hidden', 'deleted', 'reported').optional(),
  sort: Joi.string().valid('newest', 'expiry').optional(),
});

const collabListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'active', 'cancelled', 'completed').optional(),
});

const pendingBrandsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const rejectBrand = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null).optional(),
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

const droppedOffUsersQuery = Joi.object({
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
  role: Joi.string().valid('CREATOR', 'FREELANCER').optional(),
});

const blockListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const subscriptionListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(200).optional().allow(''),
  status: Joi.string().valid('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired').optional(),
});

const categoryListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().trim().max(200).optional().allow(''),
});

// Shared shape for the Brand Home content catalogs — list query is
// identical across all three, create/update differ per model.
const catalogListQuery = categoryListQuery;

const createYoutubeChannel = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  logoUrl: Joi.string().uri().allow('', null).optional(),
  subscriberCount: Joi.number().integer().min(0).default(0),
  category: Joi.string().trim().max(50).allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});
const updateYoutubeChannel = createYoutubeChannel.fork(['name'], (s) => s.optional());

const createAdType = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  iconUrl: Joi.string().uri().allow('', null).optional(),
  accentColor: Joi.string().trim().max(20).allow('', null).optional(),
  description: Joi.string().trim().max(300).allow('', null).optional(),
  sortOrder: Joi.number().integer().default(0),
  isActive: Joi.boolean().optional(),
});
const updateAdType = createAdType.fork(['name'], (s) => s.optional());

const createCelebrity = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  photoUrl: Joi.string().uri().allow('', null).optional(),
  role: Joi.string().trim().max(50).allow('', null).optional(),
  followerCount: Joi.number().integer().min(0).default(0),
  isVerified: Joi.boolean().default(false),
  profileUrl: Joi.string().uri().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});
const updateCelebrity = createCelebrity.fork(['name'], (s) => s.optional());

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

const verifyTwoFactorLogin = Joi.object({
  tempToken: Joi.string().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const twoFactorCode = Joi.object({
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const createAdmin = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  role: Joi.string().valid('SUPER_ADMIN', 'MODERATOR').required(),
});

const updateAdmin = Joi.object({
  role: Joi.string().valid('SUPER_ADMIN', 'MODERATOR').optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const bulkPostAction = Joi.object({
  postIds: Joi.array().items(Joi.string().uuid()).min(1).max(200).required(),
  action: Joi.string().valid('approve', 'hide', 'restore', 'delete').required(),
});

const bulkUserIds = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).min(1).max(200).required(),
});

const broadcast = Joi.object({
  title: Joi.string().trim().min(1).max(100).required(),
  body: Joi.string().trim().min(1).max(500).required(),
  target: Joi.string().valid('all', 'creators', 'freelancers', 'premium', 'incomplete_profile', 'category', 'users').required(),
  categoryId: uuid.when('target', { is: 'category', then: Joi.required(), otherwise: Joi.forbidden() }),
  userIds: Joi.array().items(uuid).min(1).max(500)
    .when('target', { is: 'users', then: Joi.required(), otherwise: Joi.forbidden() }),
});

module.exports = {
  login,
  listQuery,
  postListQuery,
  collabListQuery,
  reportListQuery,
  statsQuery,
  droppedOffUsersQuery,
  reviewReport,
  idParam,
  blockListQuery,
  subscriptionListQuery,
  categoryListQuery,
  createCategory,
  updateCategory,
  verifyTwoFactorLogin,
  twoFactorCode,
  createAdmin,
  updateAdmin,
  bulkPostAction,
  bulkUserIds,
  broadcast,
  pendingBrandsQuery,
  rejectBrand,
  catalogListQuery,
  createYoutubeChannel,
  updateYoutubeChannel,
  createAdType,
  updateAdType,
  createCelebrity,
  updateCelebrity,
};
