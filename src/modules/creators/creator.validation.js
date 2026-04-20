const Joi = require('joi');
const { url, email, uuid } = require('../../validations/common.validation');

const baseCreatorFields = {
  profilePicture: url.allow('', null).optional(),
  profilePictureKey: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(100),
  email: email.allow('', null).optional(),
  categoryId: uuid.optional(),
  language: Joi.string().trim().max(50).allow('', null).optional(),
  bio: Joi.string().trim().max(1000).allow('', null).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  // Social presence
  instagramHandle: Joi.string().trim().max(100).allow('', null).optional(),
  instagramFollowers: Joi.number().integer().min(0).allow(null).optional(),
  youtubeHandle: Joi.string().trim().max(100).allow('', null).optional(),
  youtubeFollowers: Joi.number().integer().min(0).allow(null).optional(),
  twitterHandle: Joi.string().trim().max(100).allow('', null).optional(),
  twitterFollowers: Joi.number().integer().min(0).allow(null).optional(),
  snapchatHandle: Joi.string().trim().max(100).allow('', null).optional(),
  // Collab preferences
  preferredCollabType: Joi.string().valid('PAID', 'UNPAID').optional(),
  isAvailableForCollab: Joi.boolean().optional(),
};

const createCreatorProfileSchema = Joi.object({
  ...baseCreatorFields,
  name: baseCreatorFields.name.required(),
});

const updateCreatorProfileSchema = Joi.object(baseCreatorFields).min(1);

module.exports = { createCreatorProfileSchema, updateCreatorProfileSchema };
