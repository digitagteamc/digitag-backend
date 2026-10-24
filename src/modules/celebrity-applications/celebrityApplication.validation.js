const Joi = require('joi');
const { pagination, uuid } = require('../../validations/common.validation');

// Option ids/labels match the website's Celebrity panel
// (digitag-website/app/Celebrity-panel/BrandStep.tsx, OnboardingFlow.tsx).
const PARTNER_TYPES = ['Celebrity', 'Creator', 'Influencer', 'Agency'];
const BRAND_INTEGRATIONS = [
  'l-bands', 'full-screen-ad', 'streak-ad', 'product-showcases',
  'community-mentions', 'collaborative-releases', 'brand-endorsements',
];
const STATUSES = ['REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

// Follower / subscriber counts as typed in ChannelsStep: 1200, 1,200, 185K, 2.4M.
const count = (label) => Joi.string().trim().max(20).pattern(/^\d[\d,]*(\.\d+)?\s*[kKmM]?$/).required()
  .messages({ 'string.pattern.base': `Enter ${label} as a number, e.g. 185K or 2.4M.` });

const submitOnboarding = Joi.object({
  onboardingDate: Joi.date().iso().required(),
  effectiveDate: Joi.date().iso().required(),
  legalName: Joi.string().trim().min(2).max(150).required(),
  partnerType: Joi.string().valid(...PARTNER_TYPES).required(),
  // Optional profile photo (ProfilePhoto.tsx); the website downsizes it before sending.
  photo: Joi.string().pattern(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(3_000_000).allow('', null).optional()
    .messages({ 'string.pattern.base': 'Profile photo must be a JPG, PNG or WEBP image.', 'string.max': 'Profile photo is too large.' }),
  instagramAccounts: Joi.array().items(Joi.object({
    handle: Joi.string().trim().replace(/^@+/, '').min(1).max(100).required(),
    followers: count('follower counts'),
  })).max(10).default([]),
  youtubeChannels: Joi.array().items(Joi.object({
    name: Joi.string().trim().min(1).max(120).required(),
    url: Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(500).required(),
    subscribers: count('subscriber counts'),
  })).max(10).default([]),
  brandIntegrations: Joi.array().items(Joi.string().valid(...BRAND_INTEGRATIONS)).min(1).unique().required(),
  managementAgreed: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'Please confirm the management terms to continue.' }),
  confirmed: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'Please confirm all three statements before signing.' }),
  // data:image/png;base64,… from the draw pad or an uploaded PNG/JPG (≈1.5 MB cap).
  signature: Joi.string().pattern(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).max(2_000_000).required()
    .messages({ 'string.pattern.base': 'Signature must be a PNG or JPG image.', 'string.max': 'Signature image is too large.' }),
  signedName: Joi.string().trim().min(2).max(150).required(),
  signedDate: Joi.date().iso().required(),
}).custom((v, helpers) => (v.instagramAccounts.length || v.youtubeChannels.length
  ? v
  : helpers.message('Add at least one Instagram handle or YouTube channel.')));

const listQuery = pagination.keys({
  status: Joi.string().valid(...STATUSES).optional(),
  search: Joi.string().trim().max(120).allow('').optional(),
});

const reject = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null).optional(),
});

const idParam = Joi.object({ id: uuid.required() });

module.exports = { submitOnboarding, listQuery, reject, idParam, BRAND_INTEGRATIONS, PARTNER_TYPES };
