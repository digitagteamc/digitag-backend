const { ApiError } = require('../utils/apiResponse');

const DEFAULT_JOI_OPTIONS = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
};

function formatJoiErrors(error) {
  return error.details.map((d) => ({
    path: d.path.join('.'),
    message: d.message.replace(/"/g, ''),
  }));
}

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    if (!schema) return next();

    const data = req[source];
    const { value, error } = schema.validate(data, DEFAULT_JOI_OPTIONS);

    if (error) {
      return next(ApiError.unprocessable('Validation failed', formatJoiErrors(error)));
    }

    req[source] = value;
    return next();
  };
}

function validateRequest({ body, query, params } = {}) {
  return (req, _res, next) => {
    const errors = [];

    for (const [source, schema] of Object.entries({ body, query, params })) {
      if (!schema) continue;
      const { value, error } = schema.validate(req[source], DEFAULT_JOI_OPTIONS);
      if (error) {
        errors.push(...formatJoiErrors(error).map((e) => ({ ...e, source })));
      } else {
        req[source] = value;
      }
    }

    if (errors.length) return next(ApiError.unprocessable('Validation failed', errors));
    return next();
  };
}

module.exports = { validate, validateRequest };
