const tokenService = require('../services/token/token.service');
const { prisma } = require('../config/db');
const { ApiError } = require('../utils/apiResponse');
const MESSAGES = require('../constants/messages');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        mobileNumber: true,
        role: true,
        categoryId: true,
        isVerified: true,
        isProfileCompleted: true,
        status: true,
      },
    });

    if (!user) throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_SUSPENDED);
    }

    req.user = user;
    req.tokenPayload = payload;
    return next();
  } catch (err) {
    return next(err);
  }
}

function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.tokenPayload = tokenService.verifyAccessToken(token);
  } catch {
    // ignore — behave as unauthenticated
  }
  return next();
}

module.exports = { authenticate, optionalAuth };
