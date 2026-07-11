require('dotenv').config();

const required = (key, fallback = undefined) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const optional = (key, fallback = '') => process.env[key] ?? fallback;

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: toInt(process.env.PORT, 5000),
  API_PREFIX: optional('API_PREFIX', '/api/v1'),
  CORS_ORIGIN: optional('CORS_ORIGIN', '*'),

  DATABASE_URL: required('DATABASE_URL'),
  DB_CONNECTION_LIMIT: toInt(process.env.DB_CONNECTION_LIMIT, 50),

  REDIS_HOST: optional('REDIS_HOST', '127.0.0.1'),
  REDIS_PORT: toInt(process.env.REDIS_PORT, 6379),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 'dev_access_secret'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
  JWT_ACCESS_EXPIRES_IN: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '30d'),

  OTP_PROVIDER: optional('OTP_PROVIDER', 'mock'),
  OTP_LENGTH: toInt(process.env.OTP_LENGTH, 6),
  OTP_EXPIRY_MINUTES: toInt(process.env.OTP_EXPIRY_MINUTES, 5),
  OTP_MAX_ATTEMPTS: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
  OTP_RESEND_COOLDOWN_SECONDS: toInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
  TEST_PHONE_NUMBERS: optional('TEST_PHONE_NUMBERS', ''),

  TWILIO: {
    accountSid: optional('TWILIO_ACCOUNT_SID'),
    authToken: optional('TWILIO_AUTH_TOKEN'),
    phoneNumber: optional('TWILIO_PHONE_NUMBER'),
  },

  MSG91: {
    authKey: optional('MSG91_AUTH_KEY'),
    templateId: optional('MSG91_TEMPLATE_ID'),
    senderId: optional('MSG91_SENDER_ID'),
  },

  FIREBASE_PROJECT_ID: optional('FIREBASE_PROJECT_ID'),
  FIREBASE_CLIENT_EMAIL: optional('FIREBASE_CLIENT_EMAIL'),
  FIREBASE_PRIVATE_KEY: optional('FIREBASE_PRIVATE_KEY'),

  AWS: {
    region: optional('AWS_REGION', 'ap-south-1'),
    accessKeyId: optional('AWS_ACCESS_KEY_ID'),
    secretAccessKey: optional('AWS_SECRET_ACCESS_KEY'),
    bucket: optional('AWS_S3_BUCKET'),
    publicUrl: optional('AWS_S3_PUBLIC_URL'),
    signedUrlExpiresIn: toInt(process.env.AWS_S3_SIGNED_URL_EXPIRES_IN, 900),
  },

  RATE_LIMIT: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000), // 1-minute window
    max: toInt(process.env.RATE_LIMIT_MAX, 120),                   // 120 req/min per IP
    otpMax: toInt(process.env.OTP_RATE_LIMIT_MAX, 3),              // 3 OTP sends/min
  },

  LOG_LEVEL: optional('LOG_LEVEL', 'info'),

  // Instagram DM Verification
  INSTAGRAM_VERIFY_TOKEN: optional('INSTAGRAM_VERIFY_TOKEN', 'digitag_ig_verify_token'),
  INSTAGRAM_APP_SECRET: optional('INSTAGRAM_APP_SECRET'),
  INSTAGRAM_ACCESS_TOKEN: optional('INSTAGRAM_ACCESS_TOKEN'),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: optional('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
  INSTAGRAM_PAGE_TOKEN: optional('INSTAGRAM_PAGE_TOKEN'), // EAA... Facebook Page token for Business Discovery API
  DIGITAG_INSTAGRAM_USERNAME: optional('DIGITAG_INSTAGRAM_USERNAME', 'digitag.official'),

  // YouTube / Facebook OAuth verification
  SOCIAL_OAUTH_REDIRECT_URI: optional('SOCIAL_OAUTH_REDIRECT_URI'), // e.g. https://api.digitag.app/api/v1/social-verifications/callback
  APP_DEEP_LINK_URL: optional('APP_DEEP_LINK_URL', 'digitag://social-verify'),
  GOOGLE_OAUTH_CLIENT_ID: optional('GOOGLE_OAUTH_CLIENT_ID'),
  GOOGLE_OAUTH_CLIENT_SECRET: optional('GOOGLE_OAUTH_CLIENT_SECRET'),
  FACEBOOK_APP_ID: optional('FACEBOOK_APP_ID'),
  FACEBOOK_APP_SECRET: optional('FACEBOOK_APP_SECRET'),

  // Agora
  AGORA_APP_ID: optional('AGORA_APP_ID'),
  AGORA_APP_CERTIFICATE: optional('AGORA_APP_CERTIFICATE'),
};

env.isProduction = env.NODE_ENV === 'production';
env.isDevelopment = env.NODE_ENV === 'development';
env.isTest = env.NODE_ENV === 'test';

module.exports = env;
