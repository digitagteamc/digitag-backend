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
  });
}

module.exports = Sentry;
