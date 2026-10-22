const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./crm.service');

const ok = (res, data, message = MESSAGES.GENERIC.FETCHED) => success(res, { message, data });

const login = asyncHandler(async (req, res) => ok(res, await service.login(req.body), 'Logged in successfully'));
const me = asyncHandler(async (req, res) => ok(res, await service.getMe(req.channelUser)));
const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.channelUser, req.body);
  return ok(res, null, 'Password changed');
});
const updateChannel = asyncHandler(async (req, res) =>
  ok(res, await service.updateChannel(req.channelUser, req.body), MESSAGES.GENERIC.UPDATED));

const listTeam = asyncHandler(async (req, res) => ok(res, await service.listTeam(req.channelUser)));
const createTeamMember = asyncHandler(async (req, res) => {
  const data = await service.createTeamMember(req.channelUser, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});
const updateTeamMember = asyncHandler(async (req, res) =>
  ok(res, await service.updateTeamMember(req.channelUser, req.params.id, req.body), MESSAGES.GENERIC.UPDATED));

const stats = asyncHandler(async (req, res) => ok(res, await service.getStats(req.channelUser)));
const listAdRequests = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listAdRequests(req.channelUser, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});
const getAdRequest = asyncHandler(async (req, res) => ok(res, await service.getAdRequest(req.channelUser, req.params.id)));
const updateAdRequestStatus = asyncHandler(async (req, res) =>
  ok(res, await service.updateAdRequestStatus(req.channelUser, req.params.id, req.body), 'Status updated'));
const addNote = asyncHandler(async (req, res) =>
  ok(res, await service.addNote(req.channelUser, req.params.id, req.body.note), 'Note added'));

const adTypes = asyncHandler(async (req, res) => ok(res, await service.listAdTypesForChannel()));
const listCatalog = asyncHandler(async (req, res) => ok(res, await service.listCatalog(req.channelUser, req.query)));
const createCatalogItem = asyncHandler(async (req, res) => {
  const data = await service.createCatalogItem(req.channelUser, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});
const updateCatalogItem = asyncHandler(async (req, res) =>
  ok(res, await service.updateCatalogItem(req.channelUser, req.params.id, req.body), MESSAGES.GENERIC.UPDATED));
const archiveCatalogItem = asyncHandler(async (req, res) => {
  await service.archiveCatalogItem(req.channelUser, req.params.id);
  return ok(res, null, MESSAGES.GENERIC.DELETED);
});

const listShowcase = asyncHandler(async (req, res) => ok(res, await service.listShowcase(req.channelUser)));
const createShowcase = asyncHandler(async (req, res) => {
  const data = await service.createShowcase(req.channelUser, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});
const updateShowcase = asyncHandler(async (req, res) =>
  ok(res, await service.updateShowcase(req.channelUser, req.params.id, req.body), MESSAGES.GENERIC.UPDATED));
const deleteShowcase = asyncHandler(async (req, res) => {
  await service.deleteShowcase(req.channelUser, req.params.id);
  return ok(res, null, MESSAGES.GENERIC.DELETED);
});

const presignUpload = asyncHandler(async (req, res) => ok(res, await service.presignUpload(req.channelUser, req.body)));

module.exports = {
  login, me, changePassword, updateChannel,
  listTeam, createTeamMember, updateTeamMember,
  stats, listAdRequests, getAdRequest, updateAdRequestStatus, addNote,
  adTypes, listCatalog, createCatalogItem, updateCatalogItem, archiveCatalogItem,
  listShowcase, createShowcase, updateShowcase, deleteShowcase,
  presignUpload,
};
