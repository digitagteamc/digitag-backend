const { prisma } = require('../../config/db');

async function createReport(reportedBy, { type, targetId, targetName, reason }) {
  return prisma.report.create({
    data: { type, targetId, targetName, reason, reportedBy },
  });
}

module.exports = { createReport };
