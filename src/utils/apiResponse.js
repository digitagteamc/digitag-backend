const STATUS = require('../constants/statusCodes');
const MESSAGES = require('../constants/messages');

class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = MESSAGES.GENERIC.BAD_REQUEST, details) {
    return new ApiError(STATUS.BAD_REQUEST, message, details);
  }
  static unauthorized(message = MESSAGES.GENERIC.UNAUTHORIZED) {
    return new ApiError(STATUS.UNAUTHORIZED, message);
  }
  static forbidden(message = MESSAGES.GENERIC.FORBIDDEN) {
    return new ApiError(STATUS.FORBIDDEN, message);
  }
  static notFound(message = MESSAGES.GENERIC.NOT_FOUND) {
    return new ApiError(STATUS.NOT_FOUND, message);
  }
  static conflict(message = MESSAGES.GENERIC.CONFLICT) {
    return new ApiError(STATUS.CONFLICT, message);
  }
  static unprocessable(message = MESSAGES.GENERIC.VALIDATION_FAILED, details) {
    return new ApiError(STATUS.UNPROCESSABLE, message, details);
  }
  static tooMany(message = 'Too many requests', details = null) {
    return new ApiError(STATUS.TOO_MANY_REQUESTS, message, details);
  }
  static internal(message = MESSAGES.GENERIC.INTERNAL) {
    return new ApiError(STATUS.INTERNAL, message);
  }
}

function success(res, { statusCode = STATUS.OK, message = MESSAGES.GENERIC.SUCCESS, data = null, meta = null } = {}) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (meta !== null) body.meta = meta;
  return res.status(statusCode).json(body);
}

function failure(res, { statusCode = STATUS.BAD_REQUEST, message = MESSAGES.GENERIC.BAD_REQUEST, details = null } = {}) {
  const body = { success: false, message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { ApiError, success, failure };
