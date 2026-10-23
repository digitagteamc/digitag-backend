const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./celebrityApplication.service');

const ok = (res, data, message = MESSAGES.GENERIC.FETCHED) => success(res, { message, data });

module.exports = {
  create: asyncHandler(async (req, res) => success(res, {
    statusCode: STATUS.CREATED,
    message: 'Request received',
    data: await service.createApplication(req.body, { ip: req.ip, userAgent: req.get('user-agent') }),
  })),
  submitOnboarding: asyncHandler(async (req, res) =>
    ok(res, await service.submitOnboarding(req.params.id, req.body), 'Onboarding submitted')),

  list: asyncHandler(async (req, res) => {
    const { items, meta } = await service.listApplications(req.query);
    return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
  }),
  get: asyncHandler(async (req, res) => ok(res, await service.getApplication(req.params.id))),
  approve: asyncHandler(async (req, res) =>
    ok(res, await service.reviewApplication(req.admin, req.params.id, 'APPROVED'), 'Application approved')),
  reject: asyncHandler(async (req, res) =>
    ok(res, await service.reviewApplication(req.admin, req.params.id, 'REJECTED', req.body.reason), 'Application rejected')),
};
