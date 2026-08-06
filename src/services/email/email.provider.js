/**
 * EmailProvider — base interface for OTP email delivery.
 * Implementations must return { delivered: boolean, messageId?: string }.
 */
class EmailProvider {
  // eslint-disable-next-line no-unused-vars
  async send({ to, code, expiryMinutes }) {
    throw new Error('EmailProvider.send not implemented');
  }
}

module.exports = EmailProvider;
