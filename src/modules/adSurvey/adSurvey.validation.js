const Joi = require('joi');
const { email, mobileNumber } = require('../../validations/common.validation');

// Surveys that exist on the website. Anything else is rejected so a scripted
// client can't fill the table with made-up survey slugs.
const SURVEYS = ['harsha-ad-survey'];

const text = (max) => Joi.string().trim().min(1).max(max);
const optionalText = (max) => Joi.string().trim().max(max).allow('', null).optional();
const list = (maxItems) => Joi.array().items(text(150)).min(1).max(maxItems);

const createSchema = Joi.object({
  survey: Joi.string().valid(...SURVEYS).required(),
  fullName: text(150).required(),
  mobileNumber: mobileNumber.required(),
  email: email.required(),
  city: text(100).required(),
  pageName: text(150).required(),
  profileLink: text(300).required(),
  creatorType: text(100).required(),
  platforms: list(10).required(),
  contentType: text(300).required(),
  services: list(15).required(),
  // Skipped when only design / writing services are picked (no videos).
  videosPerMonth: optionalText(50),
  languages: list(10).required(),
  serviceDuration: text(100).required(),
  monthlyBudget: text(100).required(),
  startTimeline: text(100).required(),
  references: optionalText(1000),
  additionalNotes: optionalText(1500),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(150),
  ref: optionalText(100),
});

const listQuery = Joi.object({
  survey: Joi.string().valid(...SURVEYS).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(150).optional().allow(''),
});

const exportQuery = listQuery.fork(['page', 'limit'], (s) => s.strip());

module.exports = { SURVEYS, createSchema, listQuery, exportQuery };
