const env = require('../../config/env');
const logger = require('../../utils/logger');

function configured() {
  return Boolean(env.AISENSY_API_KEY && env.AISENSY_CAMPAIGN_NAME);
}

/**
 * Sends an event ticket over WhatsApp via AiSensy's Campaign API. Request
 * shape follows AiSensy's documented "Send WhatsApp Message" v2 contract
 * (apiKey/campaignName/destination/templateParams/media) — worth confirming
 * against the live AiSensy dashboard once real credentials are wired in,
 * since BSP API contracts do shift over time.
 *
 * Fire-and-forget by design: a failed/slow WhatsApp send must never block
 * registration (see eventRegistration.service.js's createRegistration,
 * which calls this inside setImmediate). Returns 'sent' | 'failed' | 'skipped'
 * for the caller to persist onto EventRegistration.whatsappStatus.
 */
async function sendTicketMessage({ to, name, eventName, qrImageUrl, ticketUrl }) {
  if (!configured()) {
    logger.warn('[WhatsApp] AISENSY_API_KEY/AISENSY_CAMPAIGN_NAME not set — skipping send', { to });
    return 'skipped';
  }

  try {
    const destination = to.replace(/\D/g, '');
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: env.AISENSY_API_KEY,
        campaignName: env.AISENSY_CAMPAIGN_NAME,
        destination: destination.startsWith('91') ? destination : `91${destination}`,
        userName: name,
        templateParams: [name, eventName],
        media: { url: qrImageUrl, filename: 'ticket-qr.png' },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('[WhatsApp] AiSensy send failed', { to, status: res.status, body: body.slice(0, 500) });
      return 'failed';
    }

    logger.info('[WhatsApp] Ticket sent', { to, ticketUrl });
    return 'sent';
  } catch (err) {
    logger.error('[WhatsApp] AiSensy send threw', { to, err: err.message });
    return 'failed';
  }
}

module.exports = { configured, sendTicketMessage };
