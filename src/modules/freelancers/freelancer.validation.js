const Joi = require('joi');
const { url, email, uuid } = require('../../validations/common.validation');

const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const AVAILABILITIES = ['AVAILABLE', 'BUSY', 'NOT_AVAILABLE'];

const baseFreelancerFields = {
  profilePicture: Joi.string().allow('', null).optional(),
  profilePictureKey: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(100),
  email: email.allow('', null).optional(),
  categoryId: uuid.optional(),
  categories: Joi.array().items(Joi.string()).max(1).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  language: Joi.string().trim().max(50).allow('', null).optional(),
  bio: Joi.string().trim().max(1000).allow('', null).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  // Freelancer-specific
  skills: Joi.array().items(Joi.string().trim().max(60)).max(20).optional(),
  hourlyRate: Joi.number().min(0).max(999999).precision(2).allow(null).optional(),
  experienceLevel: Joi.string().valid(...EXPERIENCE_LEVELS).allow(null).optional(),
  portfolioUrl: Joi.string().trim().max(255).allow('', null).optional(),
  availability: Joi.string().valid(...AVAILABILITIES).optional(),
  servicesOffered: Joi.string().trim().max(500).allow('', null).optional(),
  // Social Media Manager-only checkboxes — harmless if sent for any other
  // category, the mobile app just never shows them outside that one.
  workTypes: Joi.array().items(Joi.string().valid('PART_TIME', 'FULL_TIME')).max(2).optional(),
  // Social presence
  instagramHandle: Joi.string().trim().max(100).allow('', null).optional(),
  instagramFollowers: Joi.number().integer().min(0).allow(null).optional(),
  youtubeHandle: Joi.string().trim().max(100).allow('', null).optional(),
  youtubeFollowers: Joi.number().integer().min(0).allow(null).optional(),
  twitterHandle: Joi.string().trim().max(100).allow('', null).optional(),
  twitterFollowers: Joi.number().integer().min(0).allow(null).optional(),
  snapchatHandle: Joi.string().trim().max(100).allow('', null).optional(),
  snapchatFollowers: Joi.number().integer().min(0).allow(null).optional(),
  facebookHandle: Joi.string().trim().max(100).allow('', null).optional(),
  facebookFollowers: Joi.number().integer().min(0).allow(null).optional(),
};

const createFreelancerProfileSchema = Joi.object({
  ...baseFreelancerFields,
  name: baseFreelancerFields.name.required(),
  // Required at signup (also drives the admin-only DigiTag) — stays optional
  // on update so partial edits don't need to resend them. portfolioUrl
  // intentionally stays optional — not every freelancer has one.
  location: Joi.string().trim().min(1).max(120).required(),
  language: Joi.string().trim().min(1).max(50).required(),
  // Must additionally match a VERIFIED EmailVerification row for this user
  // at the service layer (see profileService.ensureEmailVerified).
  email: email.required().messages({
    'any.required': 'Email is required',
    'string.email': 'Enter a valid email address',
  }),
});

const updateFreelancerProfileSchema = Joi.object(baseFreelancerFields).min(1);

module.exports = { createFreelancerProfileSchema, updateFreelancerProfileSchema };
