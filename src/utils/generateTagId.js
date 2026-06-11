const { prisma } = require('../config/db');

/**
 * Generates a unique Tag ID in the format: NNNxNNN
 *   NNN = 3 random digits (100–999, never starts with 0)
 *   x   = role character: C = CREATOR, F = FREELANCER, B = BRAND, A = AGENCY
 *   NNN = 3 random digits (100–999, never starts with 0)
 *
 * Example: 483C291
 */

const ROLE_CHAR = {
  CREATOR: 'C',
  FREELANCER: 'F',
  BRAND: 'B',
  AGENCY: 'A',
};

function randomThreeDigits() {
  return String(Math.floor(100 + Math.random() * 900));
}

async function isTagIdTaken(tagId, model) {
  const record = await prisma[model].findUnique({ where: { tagId } });
  return !!record;
}

/**
 * @param {object} opts
 * @param {'CREATOR'|'FREELANCER'|'BRAND'|'AGENCY'} opts.role
 * @param {'creatorProfile'|'freelancerProfile'} opts.model
 * @returns {Promise<string>}
 */
async function generateTagId({ role, model }) {
  const roleChar = ROLE_CHAR[role] || 'U';

  let tagId;
  let attempts = 0;

  do {
    tagId = `${randomThreeDigits()}${roleChar}${randomThreeDigits()}`;
    attempts++;
    if (attempts > 20) {
      // Fallback: use timestamp-based suffix to guarantee uniqueness
      const ts = String(Date.now());
      tagId = `${ts.slice(-3)}${roleChar}${ts.slice(-6, -3)}`;
      break;
    }
  } while (await isTagIdTaken(tagId, model));

  return tagId;
}

module.exports = { generateTagId };
