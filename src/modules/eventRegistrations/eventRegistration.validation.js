const Joi = require('joi');
const { email, mobileNumber } = require('../../validations/common.validation');

const createRegistrationSchema = Joi.object({
  eventSlug: Joi.string().trim().max(100).required(),
  name: Joi.string().trim().min(1).max(150).required(),
  email: email.required(),
  mobileNumber: mobileNumber.required(),
  instagramLink: Joi.string().trim().min(1).max(300).required(),
  location: Joi.string().trim().min(1).max(150).required(),
});

const listQuery = Joi.object({
  eventSlug: Joi.string().trim().max(100).optional(),
  search: Joi.string().trim().max(150).optional(),
  checkedIn: Joi.string().valid('true', 'false').optional(),
}).unknown(true);

const checkinSchema = Joi.object({
  ticketCode: Joi.string().trim().required(),
});

module.exports = { createRegistrationSchema, listQuery, checkinSchema };
