const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const startVerificationSchema = Joi.object({
  instagramUrl: Joi.string().trim().min(1).required().messages({
    'string.empty': 'instagramUrl is required',
    'any.required': 'instagramUrl is required',
  }),
});

const idParam = Joi.object({ id: uuid.required() });

module.exports = { startVerificationSchema, idParam };
