const Joi = require('joi');
const { url, email, uuid } = require('../../validations/common.validation');

const socialLinks = {
  instagramLink: url.allow('', null).optional(),
  youtubeLink: url.allow('', null).optional(),
  snapchatLink: url.allow('', null).optional(),
  twitterLink: url.allow('', null).optional(),
};

const baseProfileFields = {
  profilePicture: url.allow('', null).optional(),
  profilePictureKey: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(100),
  email: email.allow('', null).optional(),
  categoryId: uuid.optional(),
  language: Joi.string().trim().max(50).allow('', null).optional(),
  bio: Joi.string().trim().max(1000).allow('', null).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  ...socialLinks,
};

const createProfileSchema = Joi.object({
  ...baseProfileFields,
  name: baseProfileFields.name.required(),
});

const updateProfileSchema = Joi.object(baseProfileFields).min(1);

module.exports = { createProfileSchema, updateProfileSchema, baseProfileFields };
