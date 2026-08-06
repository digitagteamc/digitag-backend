const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const EmailProvider = require('./email.provider');
const env = require('../../config/env');
const logger = require('../../utils/logger');

let client = null;
function getClient() {
  if (!client) {
    client = new SESClient({
      region: env.AWS.region,
      credentials: {
        accessKeyId: env.AWS.accessKeyId,
        secretAccessKey: env.AWS.secretAccessKey,
      },
    });
  }
  return client;
}

class SesEmailProvider extends EmailProvider {
  async send({ to, code, expiryMinutes = 10 }) {
    if (!env.AWS.accessKeyId || !env.AWS.secretAccessKey) {
      throw new Error('AWS credentials are required for SES email delivery');
    }

    const command = new SendEmailCommand({
      Source: env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `${code} is your DigiTag verification code` },
        Body: {
          Text: {
            Data: `Your DigiTag verification code is ${code}. It expires in ${expiryMinutes} minutes.\n\nIf you didn't request this, you can ignore this email.`,
          },
          Html: {
            Data: `<p>Your DigiTag verification code is <strong style="font-size:20px;letter-spacing:2px;">${code}</strong>.</p><p>It expires in ${expiryMinutes} minutes.</p><p style="color:#6b6b7a;font-size:13px;">If you didn't request this, you can ignore this email.</p>`,
          },
        },
      },
    });

    try {
      const result = await getClient().send(command);
      return { delivered: true, messageId: result.MessageId };
    } catch (err) {
      logger.error('[SES] Email OTP send failed', { err, to });
      throw err;
    }
  }
}

module.exports = SesEmailProvider;
