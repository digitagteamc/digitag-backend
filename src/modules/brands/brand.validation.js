const Joi = require('joi');
const { email, pagination } = require('../../validations/common.validation');

// Same formats the app's Brand Registration screen validates against.
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z0-9]{13}$/;

const baseBrandFields = {
  profilePicture: Joi.string().allow('', null).optional(),
  profilePictureKey: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(120),
  email: email.allow('', null).optional(),
  pan: Joi.string().trim().uppercase().pattern(PAN).messages({ 'string.pattern.base': 'pan must be a valid PAN (e.g. ABCDE1234F)' }),
  gstin: Joi.string().trim().uppercase().pattern(GSTIN).allow('', null).optional()
    .messages({ 'string.pattern.base': 'gstin must be a valid 15-character GSTIN' }),
  city: Joi.string().trim().max(80).allow('', null).optional(),
  state: Joi.string().trim().max(80).allow('', null).optional(),
  website: Joi.string().trim().max(255).allow('', null).optional(),
  industry: Joi.string().trim().max(100).allow('', null).optional(),
  bio: Joi.string().trim().max(1000).allow('', null).optional(),
  contactPerson: Joi.string().trim().max(100).allow('', null).optional(),
  contactDesignation: Joi.string().trim().max(100).allow('', null).optional(),
  companySize: Joi.string().trim().max(50).allow('', null).optional(),
  instagramHandle: Joi.string().trim().max(100).allow('', null).optional(),
  youtubeHandle: Joi.string().trim().max(100).allow('', null).optional(),
};

// Brand Registration: name + PAN required; everything else optional. The
// Complete Profile screen only asks for GST, so a GSTIN stands in for the PAN
// (the service derives the PAN embedded in it).
const createBrandProfileSchema = Joi.object({
  ...baseBrandFields,
  name: baseBrandFields.name.required(),
  pan: baseBrandFields.pan.optional(),
}).or('pan', 'gstin');

const updateBrandProfileSchema = Joi.object({ ...baseBrandFields, pan: baseBrandFields.pan.optional() }).min(1);

const requirementsQuery = pagination.keys({
  search: Joi.string().trim().max(120).optional(),
  category: Joi.string().trim().max(100).optional(),
  collaborationType: Joi.string().valid('PAID', 'UNPAID').optional(),
  location: Joi.string().trim().max(120).optional(),
});

const myPostsQuery = pagination.keys({
  status: Joi.string().valid('OPEN', 'COMPLETED', 'CLOSED').optional(),
});

const applicantsQuery = Joi.object({
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED').optional(),
}).unknown(true);

const listQuery = pagination.keys({
  search: Joi.string().trim().max(120).optional(),
});

module.exports = {
  createBrandProfileSchema,
  updateBrandProfileSchema,
  requirementsQuery,
  myPostsQuery,
  applicantsQuery,
  listQuery,
};
