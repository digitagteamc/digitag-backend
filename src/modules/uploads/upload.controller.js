const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const service = require('./upload.service');

const uploadImage = asyncHandler(async (req, res) => {
  const prefix = (req.body && req.body.prefix) || `users/${req.user.id}`;
  const data = await service.handleImageUpload(req.file, { prefix });
  return success(res, { message: MESSAGES.UPLOAD.SUCCESS, data });
});

const presignedUpload = asyncHandler(async (req, res) => {
  const { originalName, mimeType, prefix } = req.body;
  const data = await service.generatePresignedUpload({
    originalName,
    mimeType,
    prefix: prefix || `users/${req.user.id}`,
  });
  return success(res, { message: MESSAGES.UPLOAD.SUCCESS, data });
});

module.exports = { uploadImage, presignedUpload };
