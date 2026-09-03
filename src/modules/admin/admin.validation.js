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
  userId: uuid.optional(),
});

const postListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(200).optional().allow(''),
  role: Joi.string().valid('CREATOR', 'FREELANCER').optional(),
  status: Joi.string().valid('active', 'hidden', 'deleted', 'reported').optional(),
  sort: Joi.string().valid('newest', 'expiry').optional(),
  userId: uuid.optional(),
});

const collabListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'active', 'cancelled', 'completed').optional(),
  userId: uuid.optional(),
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
  target: Joi.string().valid('all', 'creators', 'freelancers', 'premium', 'incomplete_profile', 'category', 'users', 'segment').required(),
  categoryId: uuid.when('target', { is: 'category', then: Joi.required(), otherwise: Joi.forbidden() }),
  userIds: Joi.array().items(uuid).min(1).max(500)
    .when('target', { is: 'users', then: Joi.required(), otherwise: Joi.forbidden() }),
  // Custom segment — up to 4 composable filters combined with AND. At least
  // one must be set; none are individually required.
  segment: Joi.object({
    role: Joi.string().valid('CREATOR', 'FREELANCER').optional(),
    categoryId: uuid.optional(),
    inactiveDays: Joi.number().integer().min(1).max(365).optional(),
    isPremium: Joi.boolean().optional(),
  }).min(1).when('target', { is: 'segment', then: Joi.required(), otherwise: Joi.forbidden() }),
  // Where tapping the notification takes the recipient — 'NONE' means it just
  // opens the app with no deep link, same as before this field existed.
  action: Joi.string().valid('NONE', 'EXPLORE', 'SEARCH', 'COMPLETE_PROFILE', 'PRIVACY_SETTINGS', 'POST', 'USER_PROFILE').default('NONE'),
  postId: uuid.when('action', { is: 'POST', then: Joi.required(), otherwise: Joi.forbidden() }),
  profileUserId: uuid.when('action', { is: 'USER_PROFILE', then: Joi.required(), otherwise: Joi.forbidden() }),
  // Send immediately when omitted; otherwise queued as SCHEDULED and sent by
  // the sendScheduledBroadcasts poller once due.
  scheduledFor: Joi.date().iso().greater('now').optional(),
});

const broadcastListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  target: Joi.string().optional(),
  status: Joi.string().optional(),
});

const eventRegistrationListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  eventSlug: Joi.string().trim().max(100).optional(),
  search: Joi.string().trim().max(150).optional().allow(''),
  checkedIn: Joi.string().valid('true', 'false').optional(),
});

const eventRegistrationCheckin = Joi.object({
  ticketCode: uuid.required(),
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
  broadcastListQuery,
  eventRegistrationListQuery,
  eventRegistrationCheckin,
};
