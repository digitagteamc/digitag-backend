const EmailProvider = require('./email.provider');
const logger = require('../../utils/logger');

class MockEmailProvider extends EmailProvider {
  async send({ to, code }) {
    logger.info('[MockEmailProvider] Email OTP generated', { to, code });
    return { delivered: true, messageId: `mock-${Date.now()}` };
  }
}

module.exports = MockEmailProvider;
