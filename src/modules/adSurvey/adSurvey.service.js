const { prisma } = require('../../config/db');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

const blankToNull = (v) => (v === '' || v === undefined ? null : v);

async function create(data, { ipAddress, userAgent }) {
  return prisma.adSurveyResponse.create({
    data: {
      survey: data.survey,
      fullName: data.fullName,
      mobileNumber: data.mobileNumber,
      email: data.email,
      city: data.city,
      pageName: data.pageName,
      profileLink: data.profileLink,
      creatorType: data.creatorType,
      platforms: data.platforms,
      contentType: data.contentType,
      services: data.services,
      videosPerMonth: blankToNull(data.videosPerMonth),
      languages: data.languages,
      serviceDuration: data.serviceDuration,
      monthlyBudget: data.monthlyBudget,
      startTimeline: data.startTimeline,
      references: blankToNull(data.references),
      additionalNotes: blankToNull(data.additionalNotes),
      utmSource: blankToNull(data.utmSource),
      utmMedium: blankToNull(data.utmMedium),
      utmCampaign: blankToNull(data.utmCampaign),
      ref: blankToNull(data.ref),
      ipAddress: ipAddress || null,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
    },
    select: { id: true, createdAt: true },
  });
}

function buildWhere(query = {}) {
  const where = {};
  if (query.survey) where.survey = query.survey;
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' };
    where.OR = [
      { fullName: contains },
      { email: contains },
      { mobileNumber: contains },
      { city: contains },
      { pageName: contains },
      { creatorType: contains },
      { contentType: contains },
    ];
  }
  return where;
}

async function adminList(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = buildWhere(query);
  const [items, total] = await Promise.all([
    prisma.adSurveyResponse.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.adSurveyResponse.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

const COLUMNS = [
  { label: 'Submitted (IST)', get: (r) => r.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
  { label: 'Full Name', get: (r) => r.fullName },
  { label: 'Mobile / WhatsApp', get: (r) => r.mobileNumber },
  { label: 'Email', get: (r) => r.email },
  { label: 'City', get: (r) => r.city },
  { label: 'Page Name', get: (r) => r.pageName },
  { label: 'Profile Link', get: (r) => r.profileLink },
  { label: 'Creator Type', get: (r) => r.creatorType },
  { label: 'Platforms', get: (r) => r.platforms.join('; ') },
  { label: 'Content Type', get: (r) => r.contentType },
  { label: 'Services', get: (r) => r.services.join('; ') },
  { label: 'Videos / Month', get: (r) => r.videosPerMonth },
  { label: 'Languages', get: (r) => r.languages.join('; ') },
  { label: 'Service Duration', get: (r) => r.serviceDuration },
  { label: 'Monthly Budget', get: (r) => r.monthlyBudget },
  { label: 'Start', get: (r) => r.startTimeline },
  { label: 'References', get: (r) => r.references },
  { label: 'Additional Requirements', get: (r) => r.additionalNotes },
  { label: 'UTM Source', get: (r) => r.utmSource },
  { label: 'UTM Medium', get: (r) => r.utmMedium },
  { label: 'UTM Campaign', get: (r) => r.utmCampaign },
  { label: 'Ref', get: (r) => r.ref },
];

// Excel opens CSV directly. The BOM makes it read the file as UTF-8, otherwise
// ₹ and Telugu/Hindi answers come out garbled. Values starting with = + - @
// are prefixed so a typed answer can't run as a spreadsheet formula.
async function exportCsv(query = {}) {
  const rows = await prisma.adSurveyResponse.findMany({ where: buildWhere(query), orderBy: { createdAt: 'desc' } });
  const escape = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = COLUMNS.map((c) => c.label).join(',');
  const body = rows.map((r) => COLUMNS.map((c) => escape(c.get(r))).join(',')).join('\r\n');
  return `﻿${header}\r\n${body}`;
}

module.exports = { create, adminList, exportCsv };
