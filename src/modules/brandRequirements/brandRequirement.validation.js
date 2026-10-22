const Joi = require('joi');

const createRequirementSchema = Joi.object({
  targetType: Joi.string().valid('CREATORS', 'AGENCIES').default('CREATORS'),
  // The composer's "Freelancers can also see this" checkbox. AGENCIES
  // requirements always reach freelancers regardless.
  freelancersCanSee: Joi.boolean().default(false),
  title: Joi.string().trim().max(150).allow('', null).optional(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  budget: Joi.string().trim().max(100).allow('', null).optional(),
  creatorCountMin: Joi.number().integer().min(0).allow(null).optional(),
  creatorCountMax: Joi.number().integer().min(0).allow(null).optional(),
  genderPreference: Joi.string().trim().max(50).allow('', null).optional(),
  deliverables: Joi.string().trim().max(500).allow('', null).optional(),
  visibility: Joi.string().trim().max(100).allow('', null).optional(),
  message: Joi.string().trim().max(2000).allow('', null).optional(),
});

const listQuery = Joi.object({
  targetType: Joi.string().valid('CREATORS', 'AGENCIES').optional(),
  category: Joi.string().trim().max(100).optional(),
}).unknown(true);

module.exports = { createRequirementSchema, listQuery };
