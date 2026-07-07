const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

async function createReport(reportedBy, { type, targetId, targetName, reason }) {
  const existing = await prisma.report.findFirst({
    where: { reportedBy, type, targetId },
  });
  if (existing) throw ApiError.conflict('You have already reported this.');

  return prisma.report.create({
    data: { type, targetId, targetName, reason, reportedBy },
  });
}

async function getStatus(reportedBy, { type, targetId }) {
  const existing = await prisma.report.findFirst({
    where: { reportedBy, type, targetId },
  });
  return { reported: !!existing };
}

module.exports = { createReport, getStatus };
