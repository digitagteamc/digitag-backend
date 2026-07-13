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

/** App bug/feedback report — lands in the same admin Reports queue as
 *  user/post reports. No duplicate check (unlike createReport): a user can
 *  legitimately report many different issues over time. */
async function createIssueReport(reportedBy, { category, severity, description, screenshotUrl }) {
  const reason = `[${severity.toUpperCase()}] ${description}${screenshotUrl ? `\nScreenshot: ${screenshotUrl}` : ''}`;
  return prisma.report.create({
    data: {
      type: 'ISSUE',
      // There's no external target for an app issue — anchor it to the
      // reporter so the admin queue's target column still resolves.
      targetId: reportedBy,
      targetName: category,
      reason,
      reportedBy,
    },
  });
}

module.exports = { createReport, getStatus, createIssueReport };
