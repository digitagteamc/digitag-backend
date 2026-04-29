const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const env = require('../../config/env');
const { getS3Client, getPublicUrl } = require('../../config/s3');
const logger = require('../../utils/logger');

function buildKey(prefix, originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const safePrefix = (prefix || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
  return `${safePrefix}/${Date.now()}-${uuidv4()}${ext}`;
}

async function uploadBuffer({ buffer, mimeType, prefix = 'uploads', originalName = 'file' }) {
  if (!env.AWS.bucket) {
    throw new Error('AWS_S3_BUCKET not configured');
  }

  const key = buildKey(prefix, originalName);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: env.AWS.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return { key, url: getPublicUrl(key) };
}

async function deleteObject(key) {
  if (!key || !env.AWS.bucket) return;
  try {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: env.AWS.bucket, Key: key }),
    );
  } catch (err) {
    logger.warn('S3 delete failed', { key, err: err.message });
  }
}

async function getSignedReadUrl(key, expiresIn = env.AWS.signedUrlExpiresIn) {
  if (!key) return null;
  const cmd = new GetObjectCommand({ Bucket: env.AWS.bucket, Key: key });
  return getSignedUrl(getS3Client(), cmd, { expiresIn });
}

async function getPresignedUploadUrl({ prefix = 'uploads', originalName, mimeType }) {
  const key = buildKey(prefix, originalName);
  const cmd = new PutObjectCommand({
    Bucket: env.AWS.bucket,
    Key: key,
    ContentType: mimeType,
  });
  const url = await getSignedUrl(getS3Client(), cmd, { expiresIn: env.AWS.signedUrlExpiresIn });
  return { url, key, publicUrl: getPublicUrl(key) };
}

module.exports = {
  uploadBuffer,
  deleteObject,
  getSignedReadUrl,
  getPresignedUploadUrl,
  buildKey,
  getPublicUrl,
};
