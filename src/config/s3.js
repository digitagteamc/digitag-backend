const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const config = { region: env.AWS.region };

  if (env.AWS.accessKeyId && env.AWS.secretAccessKey) {
    config.credentials = {
      accessKeyId: env.AWS.accessKeyId,
      secretAccessKey: env.AWS.secretAccessKey,
    };
  }

  s3Client = new S3Client(config);
  return s3Client;
}

function getPublicUrl(key) {
  if (!key) return null;
  if (env.AWS.publicUrl) {
    return `${env.AWS.publicUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${env.AWS.bucket}.s3.${env.AWS.region}.amazonaws.com/${key}`;
}

module.exports = { getS3Client, getPublicUrl };
