/**
 * OtpProvider — base interface for OTP delivery.
 * Implementations must return { delivered: boolean, messageId?: string }.
 */
class OtpProvider {
  // eslint-disable-next-line no-unused-vars
  async send({ mobileNumber, countryCode, code, purpose }) {
    throw new Error('OtpProvider.send not implemented');
  }
}

module.exports = OtpProvider;
