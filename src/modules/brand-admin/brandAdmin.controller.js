const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./brandAdmin.service');

const YOUTUBE = { type: 'YOUTUBE' };

const ok = (res, data, message = MESSAGES.GENERIC.FETCHED) => success(res, { message, data });
const created = (res, data) => success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
const paged = (fn) => asyncHandler(async (req, res) => {
  const { items, meta } = await fn(req);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

module.exports = {
  // Brands
  listBrands: paged((req) => service.listBrands(req.query)),
  listPendingBrands: paged((req) => service.listBrands({ ...req.query, status: 'PENDING' })),
  getBrand: asyncHandler(async (req, res) => ok(res, await service.getBrand(req.params.id))),
  approveBrand: asyncHandler(async (req, res) =>
    ok(res, await service.reviewBrand(req.admin, req.params.id, 'APPROVED'), 'Brand approved')),
  rejectBrand: asyncHandler(async (req, res) =>
    ok(res, await service.reviewBrand(req.admin, req.params.id, 'REJECTED', req.body.reason), 'Brand rejected')),

  // YouTube channels (Brand Home "Top YouTube Channels")
  listYoutubeChannels: paged((req) => service.listChannels(req.query, YOUTUBE)),
  createYoutubeChannel: asyncHandler(async (req, res) => created(res, await service.createChannel(req.admin, req.body, YOUTUBE))),
  updateYoutubeChannel: asyncHandler(async (req, res) =>
    ok(res, await service.updateChannel(req.admin, req.params.id, req.body, YOUTUBE), MESSAGES.GENERIC.UPDATED)),

  // All channel types (TV etc.) + CRM logins
  listChannels: paged((req) => service.listChannels(req.query)),
  getChannel: asyncHandler(async (req, res) => ok(res, await service.getChannel(req.params.id))),
  createChannel: asyncHandler(async (req, res) => created(res, await service.createChannel(req.admin, req.body))),
  updateChannel: asyncHandler(async (req, res) =>
    ok(res, await service.updateChannel(req.admin, req.params.id, req.body), MESSAGES.GENERIC.UPDATED)),
  createChannelUser: asyncHandler(async (req, res) =>
    created(res, await service.createChannelUser(req.admin, req.params.id, req.body))),
  updateChannelUser: asyncHandler(async (req, res) =>
    ok(res, await service.updateChannelUser(req.admin, req.params.id, req.params.userId, req.body), MESSAGES.GENERIC.UPDATED)),

  // Ad types
  listAdTypes: paged((req) => service.listAdTypes(req.query)),
  createAdType: asyncHandler(async (req, res) => created(res, await service.createAdType(req.admin, req.body))),
  updateAdType: asyncHandler(async (req, res) =>
    ok(res, await service.updateAdType(req.admin, req.params.id, req.body), MESSAGES.GENERIC.UPDATED)),

  // Celebrities
  listCelebrities: paged((req) => service.listCelebrities(req.query)),
  createCelebrity: asyncHandler(async (req, res) => created(res, await service.createCelebrity(req.admin, req.body))),
  updateCelebrity: asyncHandler(async (req, res) =>
    ok(res, await service.updateCelebrity(req.admin, req.params.id, req.body), MESSAGES.GENERIC.UPDATED)),

  listAdRequests: paged((req) => service.listAdRequests(req.query)),
};
