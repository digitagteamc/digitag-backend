const Joi = require('joi');

const uuid = Joi.string().uuid({ version: ['uuidv4'] });

const mobileNumber = Joi.string()
  .pattern(/^[0-9]{7,15}$/)
  .message('mobileNumber must contain 7-15 digits');

const countryCode = Joi.string().pattern(/^\+?[0-9]{1,4}$/).default('+91');

const email = Joi.string().email({ tlds: { allow: false } });

const url = Joi.string().uri();

const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(true);

const idParam = Joi.object({ id: uuid.required() });

module.exports = {
  uuid,
  mobileNumber,
  countryCode,
  email,
  url,
  pagination,
  idParam,
};
