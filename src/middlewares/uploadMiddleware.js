const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const env = require('../config/env');
const { getS3Client } = require('../config/s3');
const { ApiError } = require('../utils/apiResponse');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest('Only image files (jpg, png, webp, gif) are allowed'));
  }
  return cb(null, true);
}

function buildKey(prefix, originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const safePrefix = (prefix || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
  return `${safePrefix}/${Date.now()}-${uuidv4()}${ext}`;
}

function createS3Storage(prefix = 'uploads') {
  return multerS3({
    s3: getS3Client(),
    bucket: env.AWS.bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata(req, _file, cb) {
      cb(null, { userId: (req.user && req.user.id) || 'anonymous' });
    },
    key(_req, file, cb) {
      cb(null, buildKey(prefix, file.originalname));
    },
  });
}

function createMemoryStorage() {
  return multer.memoryStorage();
}

function uploadImage({ prefix = 'uploads', memory = false, maxSize = MAX_SIZE } = {}) {
  const storage = memory || !env.AWS.bucket ? createMemoryStorage() : createS3Storage(prefix);
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter,
  });
}

module.exports = { uploadImage, ALLOWED_MIME, MAX_SIZE };
