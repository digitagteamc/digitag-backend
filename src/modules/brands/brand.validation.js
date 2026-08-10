const Joi = require('joi');
const { url, email } = require('../../validations/common.validation');

// Matches the mobile form's own client-side check (app/signup/brand.tsx's
// validatePan) — kept in sync so a submission that passes on-device never
// gets rejected server-side for the same field.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
// Standard GSTIN format: 2-digit state code + 10-char PAN + entity code + 'Z' + checksum.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const baseBrandFields = {
  profilePicture: Joi.string().allow('', null).optional(),
  profilePictureKey: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(150),
  email: email.allow('', null).optional(),
  bio: Joi.string().trim().max(1000).allow('', null).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  website: url.allow('', null).optional(),
  pan: Joi.string().trim().uppercase().pattern(PAN_REGEX).messages({
    'string.pattern.base': 'Enter a valid PAN (e.g. ABCDE1234F)',
  }),
  gstin: Joi.string().trim().uppercase().pattern(GSTIN_REGEX).allow('', null).optional().messages({
    'string.pattern.base': 'Enter a valid GSTIN',
  }),
  // City/State are grouped under "Optional Details" in the mobile form
  // itself — only Brand Name + PAN are required there, so validation
  // matches that rather than requiring more than the UI actually asks for.
  city: Joi.string().trim().max(120).allow('', null).optional(),
  state: Joi.string().trim().max(120).allow('', null).optional(),
};

const createBrandProfileSchema = Joi.object({
  ...baseBrandFields,
  name: baseBrandFields.name.required().messages({ 'any.required': 'Brand/company name is required' }),
  pan: baseBrandFields.pan.required().messages({ 'any.required': 'PAN is required' }),
});

const updateBrandProfileSchema = Joi.object(baseBrandFields).min(1);

module.exports = { createBrandProfileSchema, updateBrandProfileSchema };
