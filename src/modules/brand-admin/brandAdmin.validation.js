const Joi = require('joi');
const { uuid, email, url, pagination } = require('../../validations/common.validation');
const { CHANNEL_TYPES } = require('../channels/channel.validation');
const { STATUSES } = require('../ad-requests/adRequest.validation');

const searchQuery = pagination.keys({
  search: Joi.string().trim().max(120).allow('').optional(),
});

// ---- Brands
const brandListQuery = searchQuery.keys({
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
});
const rejectBrand = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null).optional(),
});

// ---- Channels. Field names match the website's YoutubeChannel type
// (name, logoUrl, subscriberCount, category, isActive); the rest are optional
// extras used by the brand catalog / CRM.
const channelFields = {
  name: Joi.string().trim().min(2).max(120),
  logoUrl: url.allow('', null),
  logoKey: Joi.string().allow('', null),
  subscriberCount: Joi.number().integer().min(0),
  category: Joi.string().trim().max(100).allow('', null),
  description: Joi.string().trim().max(2000).allow('', null),
  languages: Joi.array().items(Joi.string().trim().max(50)).max(20),
  region: Joi.string().trim().max(120).allow('', null),
  websiteUrl: url.allow('', null),
  contactEmail: email.allow('', null),
  contactPhone: Joi.string().trim().max(20).allow('', null),
  isActive: Joi.boolean(),
  isVerified: Joi.boolean(),
};
const ownerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: email.required(),
  password: Joi.string().min(8).max(128).required(),
});

const createYoutubeChannel = Joi.object({ ...channelFields, name: channelFields.name.required(), owner: ownerSchema.optional() });
const updateYoutubeChannel = Joi.object(channelFields).min(1);
const createChannel = createYoutubeChannel.keys({ type: Joi.string().valid(...CHANNEL_TYPES).required() });
const updateChannel = Joi.object({ ...channelFields, type: Joi.string().valid(...CHANNEL_TYPES) }).min(1);
const channelListQuery = searchQuery.keys({
  type: Joi.string().valid(...CHANNEL_TYPES).optional(),
  isActive: Joi.boolean().optional(),
});

const createChannelUser = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: email.required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('OWNER', 'MANAGER').default('OWNER'),
});
const updateChannelUser = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  role: Joi.string().valid('OWNER', 'MANAGER'),
  password: Joi.string().min(8).max(128),
  isActive: Joi.boolean(),
}).min(1);
const channelUserParams = Joi.object({ id: uuid.required(), userId: uuid.required() });

// ---- Ad types (website: name, iconUrl, accentColor, description, sortOrder, isActive)
const adTypeFields = {
  name: Joi.string().trim().min(2).max(100),
  iconUrl: url.allow('', null),
  accentColor: Joi.string().trim().pattern(/^#[0-9a-fA-F]{6}$/).allow('', null)
    .messages({ 'string.pattern.base': 'accentColor must be a hex color like #7352DD' }),
  description: Joi.string().trim().max(1000).allow('', null),
  sortOrder: Joi.number().integer(),
  isActive: Joi.boolean(),
};
const createAdType = Joi.object({ ...adTypeFields, name: adTypeFields.name.required() });
const updateAdType = Joi.object(adTypeFields).min(1);

// ---- Celebrities (website: name, photoUrl, role, followerCount, isVerified, profileUrl, isActive)
const celebrityFields = {
  name: Joi.string().trim().min(2).max(120),
  photoUrl: url.allow('', null),
  role: Joi.string().trim().max(100).allow('', null),
  followerCount: Joi.number().integer().min(0),
  isVerified: Joi.boolean(),
  profileUrl: url.allow('', null),
  isActive: Joi.boolean(),
};
const createCelebrity = Joi.object({ ...celebrityFields, name: celebrityFields.name.required() });
const updateCelebrity = Joi.object(celebrityFields).min(1);

const adRequestListQuery = pagination.keys({
  status: Joi.string().valid(...STATUSES).optional(),
  channelId: uuid.optional(),
});

module.exports = {
  searchQuery,
  brandListQuery,
  rejectBrand,
  createYoutubeChannel,
  updateYoutubeChannel,
  createChannel,
  updateChannel,
  channelListQuery,
  createChannelUser,
  updateChannelUser,
  channelUserParams,
  createAdType,
  updateAdType,
  createCelebrity,
  updateCelebrity,
  adRequestListQuery,
};
