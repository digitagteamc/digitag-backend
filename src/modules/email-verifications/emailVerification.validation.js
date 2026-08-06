const Joi = require('joi');
const { uuid, email } = require('../../validations/common.validation');

const startSchema = Joi.object({
  email: email.required().messages({
    'string.email': 'Enter a valid email address',
    'any.required': 'Email is required',
  }),
});

const verifySchema = Joi.object({
  id: uuid.required(),
  code: Joi.string().trim().pattern(/^\d{4,10}$/).required().messages({
    'string.pattern.base': 'Enter the code exactly as sent',
    'any.required': 'Code is required',
  }),
});

module.exports = { startSchema, verifySchema };
