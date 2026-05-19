const OtpProvider = require('./otp.provider');
const env = require('../../config/env');
const logger = require('../../utils/logger');

class Msg91OtpProvider extends OtpProvider {
    async send({ mobileNumber, countryCode = '+91', code }) {
        const authKey = env.MSG91.authKey;
        const templateId = env.MSG91.templateId;

        if (!authKey || !templateId) {
            throw new Error('MSG91 authKey and templateId are required');
        }

        // MSG91 expects number without + but with country code digits
        const mobile = `${countryCode.replace('+', '')}${mobileNumber.replace(/\D/g, '')}`;

        const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${mobile}&authkey=${authKey}&otp=${code}`;

        const res = await fetch(url, { method: 'GET' });
        const body = await res.json().catch(() => ({}));

        if (!res.ok || body?.type === 'error') {
            logger.error('[MSG91] OTP send failed', { status: res.status, body });
            throw new Error(`MSG91 error: ${body?.message || res.statusText}`);
        }

        logger.info('[MSG91] OTP sent', { mobile, msgId: body?.request_id });
        return { delivered: true, messageId: body?.request_id };
    }
}

module.exports = Msg91OtpProvider;
