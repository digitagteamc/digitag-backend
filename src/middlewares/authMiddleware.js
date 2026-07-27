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
        lastActiveAt: true,
      },
    });

    if (!user) throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID);
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
    }

    // Presence heartbeat — throttled so normal app usage doesn't hammer the DB with
    // a write on every single request. Fire-and-forget; never blocks the response.
    const staleMs = 45_000;
    if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > staleMs) {
      prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
    }

    req.user = user;
    req.tokenPayload = payload;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Populates req.user when a valid token is present, but never rejects the
// request — lets a route serve both logged-in users and anonymous guests
// (e.g. browsing a profile or the feed without an account).
async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = tokenService.verifyAccessToken(token);
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
        lastActiveAt: true,
      },
    });
    if (user && user.status !== 'SUSPENDED' && user.status !== 'DELETED') {
      req.user = user;
      req.tokenPayload = payload;
    }
  } catch {
    // Invalid/expired token — behave as unauthenticated rather than failing the request
  }
  return next();
}

module.exports = { authenticate, optionalAuth };
