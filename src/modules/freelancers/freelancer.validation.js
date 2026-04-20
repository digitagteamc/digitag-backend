const Joi = require('joi');
const { url, email, uuid } = require('../../validations/common.validation');

const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const AVAILABILITIES = ['AVAILABLE', 'BUSY', 'NOT_AVAILABLE'];

const baseFreelancerFields = {
  profilePicture: url.allow('', null).optional(),
  profilePictureKey: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(100),
  email: email.allow('', null).optional(),
  categoryId: uuid.optional(),
  language: Joi.string().trim().max(50).allow('', null).optional(),
  bio: Joi.string().trim().max(1000).allow('', null).optional(),
  location: Joi.string().trim().max(120).allow('', null).optional(),
  // Freelancer-specific
  skills: Joi.array().items(Joi.string().trim().max(60)).max(20).optional(),
  hourlyRate: Joi.number().min(0).max(999999).precision(2).allow(null).optional(),
  experienceLevel: Joi.string().valid(...EXPERIENCE_LEVELS).allow(null).optional(),
  portfolioUrl: url.allow('', null).optional(),
  availability: Joi.string().valid(...AVAILABILITIES).optional(),
  servicesOffered: Joi.string().trim().max(500).allow('', null).optional(),
};

const createFreelancerProfileSchema = Joi.object({
  ...baseFreelancerFields,
  name: baseFreelancerFields.name.required(),
});

const updateFreelancerProfileSchema = Joi.object(baseFreelancerFields).min(1);

module.exports = { createFreelancerProfileSchema, updateFreelancerProfileSchema };
