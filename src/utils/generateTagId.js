const { prisma } = require('../config/db');

/**
 * Generates a unique Tag ID in the format: CITLNG99C123
 *
 * Segments:
 *   [0-2]  3 uppercase letters from city  (e.g. HYD)
 *   [3-5]  3 uppercase letters from primary language (e.g. TEL)
 *   [6-7]  last 2 digits of mobile number  (e.g. 99)
 *   [8]    role character: C = CREATOR, F = FREELANCER
 *   [9-11] 3 random digits  (e.g. 123)
 *
 * Example: HYDTEL99C123
 */

const ROLE_CHAR = {
  CREATOR: 'C',
  FREELANCER: 'F',
};

function segment(str, len) {
  // Take only alphabetic characters, uppercase, pad with 'X'
  const letters = (str || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, len).padEnd(len, 'X');
}

function mobileLastTwo(mobile) {
  const digits = (mobile || '').replace(/\D/g, '');
  return digits.slice(-2).padStart(2, '0');
}

function randomThreeDigits() {
  return String(Math.floor(100 + Math.random() * 900));
}

async function isTagIdTaken(tagId, model) {
  const record = await prisma[model].findUnique({ where: { tagId } });
  return !!record;
}

/**
 * @param {object} opts
 * @param {string} opts.location      - City / location from profile
 * @param {string} opts.language      - Primary language from profile
 * @param {string} opts.mobileNumber  - User's mobile number
 * @param {'CREATOR'|'FREELANCER'} opts.role
 * @param {'creatorProfile'|'freelancerProfile'} opts.model - Prisma model name for uniqueness check
 * @returns {Promise<string>}
 */
async function generateTagId({ location, language, mobileNumber, role, model }) {
  const city = segment(location?.split(/[\s,]+/)[0], 3);
  const lang = segment(language, 3);
  const mobile = mobileLastTwo(mobileNumber);
  const roleChar = ROLE_CHAR[role] || 'U';

  let tagId;
  let attempts = 0;

  do {
    tagId = `${city}${lang}${mobile}${roleChar}${randomThreeDigits()}`;
    attempts++;
    if (attempts > 20) {
      // Extremely unlikely but fall back to a uuid suffix to guarantee uniqueness
      tagId = `${city}${lang}${mobile}${roleChar}${String(Date.now()).slice(-3)}`;
      break;
    }
  } while (await isTagIdTaken(tagId, model));

  return tagId;
}

module.exports = { generateTagId };
