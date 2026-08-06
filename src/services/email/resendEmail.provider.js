const { Resend } = require('resend');
const EmailProvider = require('./email.provider');
const env = require('../../config/env');
const logger = require('../../utils/logger');

let client = null;
function getClient() {
  if (!client) {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required for Resend email delivery');
    }
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}

class ResendEmailProvider extends EmailProvider {
  async send({ to, code, expiryMinutes = 10 }) {
    const { data, error } = await getClient().emails.send({
      from: env.EMAIL_FROM,
      to: [to],
      subject: `${code} is your DigiTag verification code`,
      text: `Your DigiTag verification code is ${code}. It expires in ${expiryMinutes} minutes.\n\nIf you didn't request this, you can ignore this email.`,
      html: `<p>Your DigiTag verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong>.</p><p>It expires in ${expiryMinutes} minutes.</p><p style="color:#6b6b7a;font-size:13px;">If you didn't request this, you can ignore this email.</p>`,
    });

    if (error) {
      logger.error('[Resend] Email OTP send failed', { error, to });
      throw new Error(error.message || 'Resend email delivery failed');
    }

    return { delivered: true, messageId: data.id };
  }
}

module.exports = ResendEmailProvider;
