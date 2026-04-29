const { ApiError } = require('../utils/apiResponse');

function authorize(...allowedRoles) {
  const allowed = new Set(allowedRoles.flat());

  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.has(req.user.role)) {
      return next(ApiError.forbidden('You do not have access to this resource'));
    }
    return next();
  };
}

module.exports = { authorize };
