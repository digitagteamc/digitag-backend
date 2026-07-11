const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const service = require('./socialVerification.service');

const start = asyncHandler(async (req, res) => success(res, { message: 'Verification started', data: await service.start(req.user.id, req.body.platform) }));
const status = asyncHandler(async (req, res) => success(res, { data: await service.status(req.user.id, req.params.id) }));
const callback = asyncHandler(async (req, res) => {
  const result = await service.complete(req.params.platform, req.query);
  res.redirect(302, service.appRedirect(result.id, result.status));
});

module.exports = { start, status, callback };
