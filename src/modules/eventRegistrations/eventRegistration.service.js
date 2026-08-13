const qrcode = require('qrcode');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const env = require('../../config/env');
const whatsapp = require('../../services/whatsapp/whatsapp.service');
const logger = require('../../utils/logger');

function ticketUrl(registration) {
  return `${env.WEBSITE_URL}/events/${registration.eventSlug}/ticket/${registration.ticketCode}`;
}

// Mirrors the website's lib/eventConfig.ts entries — kept minimal since the
// WhatsApp send only needs the display name and poster filename, not the
// full event page config. Add a line here alongside a new website event.
const EVENT_META = {
  'faria-abdullah-meet': { displayName: 'Faria Abdullah Creator Meet', posterFile: 'faria-abdullah-poster.jpg' },
};

async function sendTicket(registration) {
  const meta = EVENT_META[registration.eventSlug];
  const status = await whatsapp.sendTicketMessage({
    to: registration.mobileNumber,
    name: registration.name,
    eventName: meta?.displayName || registration.eventSlug,
    posterImageUrl: meta?.posterFile ? `${env.WEBSITE_URL}/events/${meta.posterFile}` : null,
    qrImageUrl: `${env.API_PUBLIC_URL}/event-registrations/${registration.ticketCode}/qr.png`,
    ticketUrl: ticketUrl(registration),
  }).catch((err) => {
    logger.error('[EventRegistration] sendTicket threw', { id: registration.id, err: err.message });
    return 'failed';
  });

  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { whatsappStatus: status },
  }).catch(() => {});
}

async function createRegistration(data) {
  const registration = await prisma.eventRegistration.create({
    data: {
      eventSlug: data.eventSlug,
      name: data.name,
      email: data.email,
      mobileNumber: data.mobileNumber,
      instagramLink: data.instagramLink,
      location: data.location,
    },
  });

  // Never let a slow/failed WhatsApp send hold up the registration response —
  // same non-blocking pattern post.service.js's createPost uses for its
  // post-create notifications.
  setImmediate(() => sendTicket(registration));

  const qrDataUrl = await qrcode.toDataURL(ticketUrl(registration));
  return { ...registration, qrDataUrl, ticketUrl: ticketUrl(registration) };
}

async function getByTicketCode(ticketCode) {
  const registration = await prisma.eventRegistration.findUnique({ where: { ticketCode } });
  if (!registration) throw ApiError.notFound('Ticket not found');
  const qrDataUrl = await qrcode.toDataURL(ticketUrl(registration));
  return { ...registration, qrDataUrl, ticketUrl: ticketUrl(registration) };
}

async function getQrPng(ticketCode) {
  const registration = await prisma.eventRegistration.findUnique({ where: { ticketCode } });
  if (!registration) throw ApiError.notFound('Ticket not found');
  return qrcode.toBuffer(ticketUrl(registration));
}

async function resendWhatsapp(ticketCode) {
  const registration = await prisma.eventRegistration.findUnique({ where: { ticketCode } });
  if (!registration) throw ApiError.notFound('Ticket not found');
  setImmediate(() => sendTicket(registration));
  return { queued: true };
}

async function adminList(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {};
  if (query.eventSlug) where.eventSlug = query.eventSlug;
  if (query.checkedIn) where.checkedIn = query.checkedIn === 'true';
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { mobileNumber: { contains: query.search, mode: 'insensitive' } },
      { instagramLink: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.eventRegistration.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.eventRegistration.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

async function checkin(ticketCode, adminId) {
  const registration = await prisma.eventRegistration.findUnique({ where: { ticketCode } });
  if (!registration) throw ApiError.notFound('Ticket not found');

  // Idempotent — a live event will have accidental double-scans. Re-scanning
  // an already-checked-in ticket still returns their details, just flagged,
  // rather than erroring on staff mid-event.
  if (registration.checkedIn) {
    return { ...registration, alreadyCheckedIn: true };
  }

  const updated = await prisma.eventRegistration.update({
    where: { ticketCode },
    data: { checkedIn: true, checkedInAt: new Date(), checkedInBy: adminId },
  });
  return { ...updated, alreadyCheckedIn: false };
}

module.exports = {
  createRegistration,
  getByTicketCode,
  getQrPng,
  resendWhatsapp,
  adminList,
  checkin,
};
