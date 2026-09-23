const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./eventRegistration.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createRegistration(req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});

const getByTicketCode = asyncHandler(async (req, res) => {
  const data = await service.getByTicketCode(req.params.ticketCode);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getQrPng = asyncHandler(async (req, res) => {
  const buffer = await service.getQrPng(req.params.ticketCode);
  res.set('Content-Type', 'image/png');
  return res.send(buffer);
});

const resendWhatsapp = asyncHandler(async (req, res) => {
  const data = await service.resendWhatsapp(req.params.ticketCode);
  return success(res, { message: 'Resend queued', data });
});

module.exports = { create, getByTicketCode, getQrPng, resendWhatsapp };
