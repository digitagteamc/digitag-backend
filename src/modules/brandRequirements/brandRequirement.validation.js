const Joi = require('joi');

const createRequirementSchema = Joi.object({
  targetType: Joi.string().valid('CREATORS', 'AGENCIES').default('CREATORS'),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  creatorCountMin: Joi.number().integer().min(0).allow(null).optional(),
  creatorCountMax: Joi.number().integer().min(0).allow(null).optional(),
  genderPreference: Joi.string().trim().max(50).allow('', null).optional(),
  deliverables: Joi.string().trim().max(500).allow('', null).optional(),
  visibility: Joi.string().trim().max(100).allow('', null).optional(),
  message: Joi.string().trim().max(2000).allow('', null).optional(),
});

module.exports = { createRequirementSchema };
