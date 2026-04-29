const crypto = require('crypto');

function generateNumericOtp(length = 6) {
  if (length < 4 || length > 10) {
    throw new Error('OTP length must be between 4 and 10');
  }
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, '0');
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function compareOtp(code, hash) {
  const computed = hashOtp(code);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { generateNumericOtp, hashOtp, compareOtp };
