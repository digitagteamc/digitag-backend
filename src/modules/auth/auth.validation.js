const Joi = require('joi');
const { mobileNumber, countryCode, uuid } = require('../../validations/common.validation');
const { PUBLIC_SIGNUP_ROLES } = require('../../constants/roles');

const sendOtpSchema = Joi.object({
  mobileNumber: mobileNumber.required(),
  countryCode: countryCode.optional(),
  role: Joi.string().valid(...PUBLIC_SIGNUP_ROLES).required(),
  categoryId: uuid.optional(),
});

const verifyOtpSchema = Joi.object({
  mobileNumber: mobileNumber.required(),
  countryCode: countryCode.optional(),
  code: Joi.string().pattern(/^\d{4,10}$/).required(),
  role: Joi.string().valid(...PUBLIC_SIGNUP_ROLES).required(),
  categoryId: uuid.optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

const switchRoleSchema = Joi.object({
  role: Joi.string().valid(...PUBLIC_SIGNUP_ROLES).required(),
});

module.exports = { sendOtpSchema, verifyOtpSchema, refreshTokenSchema, logoutSchema, switchRoleSchema };
