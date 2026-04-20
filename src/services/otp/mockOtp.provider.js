const OtpProvider = require('./otp.provider');
const logger = require('../../utils/logger');

class MockOtpProvider extends OtpProvider {
  async send({ mobileNumber, countryCode, code, purpose }) {
    logger.info('[MockOtpProvider] OTP generated', {
      to: `${countryCode}${mobileNumber}`,
      code,
      purpose,
    });
    return { delivered: true, messageId: `mock-${Date.now()}` };
  }
}

module.exports = MockOtpProvider;
