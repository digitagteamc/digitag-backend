// Must be required before the app so Sentry can hook process-level handlers
// (uncaught exceptions / unhandled rejections are captured automatically).
// Without SENTRY_DSN this never initializes and every capture call is a no-op,
// so the integration is safe to ship ahead of the account setup.
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    // The SDK auto-instruments Express/HTTP and captures unhandled request
    // errors on its own — independent of (and in addition to) any manual
    // Sentry.captureException() call in our own error middleware. So
    // filtering "noisy, not a bug" errors has to happen here too, not just
    // in errorMiddleware.js, or this exact class of event still gets
    // reported via the SDK's own automatic capture path.
    beforeSend(event, hint) {
      const err = hint && hint.originalException;
      // Client disconnected mid-request (app backgrounded, dropped
      // connection, cancelled request) — raw-body throws this from inside
      // express.json(). Expected network behavior, not an application bug.
      if (err && (err.type === 'request.aborted' || err.code === 'ECONNABORTED')) {
        return null;
      }
      return event;
    },
  });
}

module.exports = Sentry;
