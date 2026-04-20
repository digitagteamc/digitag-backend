const s3UploadService = require('../../services/s3/s3Upload.service');
const { ApiError } = require('../../utils/apiResponse');

async function handleImageUpload(file, { prefix = 'uploads' } = {}) {
  if (!file) throw ApiError.badRequest('File is required');

  // multer-s3 sets file.key and file.location. Memory storage sets file.buffer.
  if (file.key && file.location) {
    return { key: file.key, url: file.location };
  }
  if (file.buffer) {
    return s3UploadService.uploadBuffer({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      prefix,
    });
  }
  throw ApiError.badRequest('Invalid file payload');
}

async function generatePresignedUpload({ prefix, originalName, mimeType }) {
  return s3UploadService.getPresignedUploadUrl({ prefix, originalName, mimeType });
}

module.exports = { handleImageUpload, generatePresignedUpload };
