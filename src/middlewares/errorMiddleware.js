const { ApiError, failure } = require('../utils/apiResponse');
const STATUS = require('../constants/statusCodes');
const MESSAGES = require('../constants/messages');
const logger = require('../utils/logger');
const Sentry = require('../config/sentry');
const env = require('../config/env');

function notFoundHandler(_req, res) {
  return failure(res, { statusCode: STATUS.NOT_FOUND, message: MESSAGES.GENERIC.NOT_FOUND });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Prisma known errors
  if (err && err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      const target = (err.meta && err.meta.target) || 'field';
      return failure(res, {
        statusCode: STATUS.CONFLICT,
        message: `Duplicate value for ${Array.isArray(target) ? target.join(', ') : target}`,
      });
    }
    if (err.code === 'P2025') {
      return failure(res, { statusCode: STATUS.NOT_FOUND, message: MESSAGES.GENERIC.NOT_FOUND });
    }
  }

  // Multer file errors
  if (err && err.name === 'MulterError') {
    return failure(res, { statusCode: STATUS.BAD_REQUEST, message: err.message });
  }

  // Client disconnected before the request body finished uploading (app
  // backgrounded, connection dropped, request cancelled mid-flight) — raw-body
  // (underlying express.json()) throws this with type 'request.aborted'.
  // Expected network behavior, not a bug: respond plainly and never send it
  // to Sentry, or every flaky connection shows up as a false alarm.
  if (err && err.type === 'request.aborted') {
    return failure(res, { statusCode: STATUS.BAD_REQUEST, message: 'Request aborted' });
  }

  if (err instanceof ApiError || (err && err.isOperational)) {
    return failure(res, {
      statusCode: err.statusCode || STATUS.BAD_REQUEST,
      message: err.message,
      details: err.details,
    });
  }

  logger.error('Unhandled error', {
    message: err && err.message,
    stack: err && err.stack,
    path: req.path,
    method: req.method,
  });
  // Only genuinely unhandled errors reach here — operational ApiErrors returned
  // above never hit Sentry, so the feed stays signal, not noise.
  Sentry.captureException(err, { extra: { path: req.path, method: req.method } });

  return failure(res, {
    statusCode: STATUS.INTERNAL,
    message: env.isProduction ? MESSAGES.GENERIC.INTERNAL : (err && err.message) || MESSAGES.GENERIC.INTERNAL,
  });
}

module.exports = { notFoundHandler, errorHandler };
