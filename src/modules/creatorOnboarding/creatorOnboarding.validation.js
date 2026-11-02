const Joi = require('joi');
const { email, mobileNumber } = require('../../validations/common.validation');

const optionalText = (max) => Joi.string().trim().max(max).allow('', null).optional();
const optionalCount = Joi.number().integer().min(0).max(10_000_000_000).allow(null).optional();

const createSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(150).required(),
  mobileNumber: mobileNumber.required(),
  email: email.required(),
  dateOfBirth: Joi.date().iso().max('now').allow(null, '').optional(),
  gender: optionalText(30),
  city: Joi.string().trim().min(1).max(100).required(),
  state: Joi.string().trim().min(1).max(100).required(),
  languages: optionalText(200),
  category: Joi.string().trim().min(1).max(150).required(),
  bio: optionalText(1000),
  instagramUrl: optionalText(300),
  instagramFollowers: optionalCount,
  youtubeUrl: optionalText(300),
  youtubeSubscribers: optionalCount,
  facebookUrl: optionalText(300),
  twitterUrl: optionalText(300),
  linkedinUrl: optionalText(300),
  otherSocialUrl: optionalText(300),
  referredBy: optionalText(100),
  agreementVersion: Joi.string().trim().max(50).required(),
  agreed: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'You must accept the agreement' }),
  signedName: Joi.string().trim().min(1).max(150).required(),
  // Drawn signature, PNG data URL from the website's canvas. Capped well
  // under the 5mb JSON body limit — a real signature is ~10–40KB.
  signatureImage: Joi.string().pattern(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).max(500_000).required()
    .messages({ 'string.pattern.base': 'Please sign the agreement' }),
});

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(150).optional().allow(''),
});

module.exports = { createSchema, listQuery };
