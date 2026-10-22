const Joi = require('joi');
const { uuid, email, url, pagination } = require('../../validations/common.validation');
const { STATUSES } = require('../ad-requests/adRequest.validation');

const password = Joi.string().min(8).max(128);

const login = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password.required(),
});

const updateChannel = Joi.object({
  description: Joi.string().trim().max(2000).allow('', null).optional(),
  logoUrl: url.allow('', null).optional(),
  languages: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  region: Joi.string().trim().max(120).allow('', null).optional(),
  subscriberCount: Joi.number().integer().min(0).optional(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  websiteUrl: url.allow('', null).optional(),
  contactEmail: email.allow('', null).optional(),
  contactPhone: Joi.string().trim().max(20).allow('', null).optional(),
}).min(1);

const createTeamMember = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: email.required(),
  password: password.required(),
  role: Joi.string().valid('OWNER', 'MANAGER').default('MANAGER'),
});

const updateTeamMember = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  role: Joi.string().valid('OWNER', 'MANAGER').optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const adRequestListQuery = pagination.keys({
  status: Joi.string().valid(...STATUSES).optional(),
  search: Joi.string().trim().max(120).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  sort: Joi.string().valid('newest', 'oldest').optional(),
});

// The CRM can only move requests into these; CANCELLED is the brand's action.
const updateStatus = Joi.object({
  status: Joi.string().valid('UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED').required(),
  note: Joi.string().trim().max(2000).allow('', null).optional(),
});

const note = Joi.object({
  note: Joi.string().trim().min(1).max(2000).required(),
});

const catalogFields = {
  adTypeId: uuid,
  name: Joi.string().trim().min(1).max(150),
  description: Joi.string().trim().max(2000).allow('', null),
  unit: Joi.string().trim().min(1).max(60),
  price: Joi.number().min(0).precision(2),
  currency: Joi.string().trim().uppercase().length(3),
  minQuantity: Joi.number().integer().min(1),
  slot: Joi.string().trim().max(120).allow('', null),
  durationSeconds: Joi.number().integer().min(1).allow(null),
  mediaUrl: url.allow('', null),
  sortOrder: Joi.number().integer(),
  isActive: Joi.boolean(),
};

const createCatalogItem = Joi.object({
  ...catalogFields,
  adTypeId: catalogFields.adTypeId.required(),
  name: catalogFields.name.required(),
  unit: catalogFields.unit.required(),
  price: catalogFields.price.required(),
});

const updateCatalogItem = Joi.object(catalogFields).min(1);

const catalogQuery = Joi.object({
  adTypeId: uuid.optional(),
  includeInactive: Joi.boolean().optional(),
}).unknown(true);

const showcaseFields = {
  brandName: Joi.string().trim().min(1).max(120),
  brandLogoUrl: url.allow('', null),
  title: Joi.string().trim().min(1).max(150),
  description: Joi.string().trim().max(2000).allow('', null),
  mediaUrl: url.allow('', null),
  adTypeName: Joi.string().trim().max(100).allow('', null),
  campaignDate: Joi.date().iso().allow(null),
  sortOrder: Joi.number().integer(),
};

const createShowcase = Joi.object({
  ...showcaseFields,
  brandName: showcaseFields.brandName.required(),
  title: showcaseFields.title.required(),
});

const updateShowcase = Joi.object(showcaseFields).min(1);

// Logos/showcase images plus demo ad videos.
const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];

const presignUpload = Joi.object({
  originalName: Joi.string().max(255).required(),
  mimeType: Joi.string().valid(...UPLOAD_MIME_TYPES).required(),
});

module.exports = {
  login,
  changePassword,
  updateChannel,
  createTeamMember,
  updateTeamMember,
  adRequestListQuery,
  updateStatus,
  note,
  createCatalogItem,
  updateCatalogItem,
  catalogQuery,
  createShowcase,
  updateShowcase,
  presignUpload,
};
