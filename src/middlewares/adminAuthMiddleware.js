const tokenService = require('../services/token/token.service');
const { prisma } = require('../config/db');
const { ApiError } = require('../utils/apiResponse');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

async function authenticateAdmin(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Admin token required');

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired admin token');
    }

    if (payload.role !== 'ADMIN') throw ApiError.forbidden('Admin access required');

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, isActive: true, role: true },
    });

    if (!admin) throw ApiError.unauthorized('Admin account not found');
    if (!admin.isActive) throw ApiError.forbidden('Admin account is inactive');

    req.admin = admin;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Gates routes to SUPER_ADMIN only — user deletion, premium grants, admin
// team management, revenue. Must run after authenticateAdmin (needs req.admin).
function requireSuperAdmin(req, _res, next) {
  if (req.admin?.role !== 'SUPER_ADMIN') return next(ApiError.forbidden('Super admin access required'));
  return next();
}

module.exports = { authenticateAdmin, requireSuperAdmin };
