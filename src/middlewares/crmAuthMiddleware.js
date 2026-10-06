const tokenService = require('../services/token/token.service');
const { prisma } = require('../config/db');
const { ApiError } = require('../utils/apiResponse');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

// Channel CRM auth — tokens carry role 'CHANNEL' and sub = ChannelUser.id,
// so they can't be used on app (User) or admin routes, and vice versa.
async function authenticateChannelUser(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('CRM token required');

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired CRM token');
    }
    if (payload.role !== 'CHANNEL') throw ApiError.forbidden('Channel CRM access required');

    const channelUser = await prisma.channelUser.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, channelId: true,
        channel: { select: { id: true, name: true, type: true, isActive: true } },
      },
    });
    if (!channelUser) throw ApiError.unauthorized('CRM account not found');
    if (!channelUser.isActive) throw ApiError.forbidden('CRM account is inactive');
    if (!channelUser.channel.isActive) throw ApiError.forbidden('This channel is currently disabled');

    req.channelUser = channelUser;
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireChannelOwner(req, _res, next) {
  if (req.channelUser?.role !== 'OWNER') return next(ApiError.forbidden('Channel owner access required'));
  return next();
}

module.exports = { authenticateChannelUser, requireChannelOwner };
