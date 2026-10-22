const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const env = require('./config/env');
const { createRateLimiter } = require('./utils/rateLimiter');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(compression());
// Stash the raw body bytes alongside the parsed JSON — the Razorpay webhook handler
// needs the exact raw bytes to verify the X-Razorpay-Signature HMAC; re-serializing
// req.body wouldn't byte-for-byte match what Razorpay signed.
app.use(express.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

if (!env.isTest) {
  app.use(
    morgan(env.isProduction ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http ? logger.http(msg.trim()) : logger.info(msg.trim()) },
    }),
  );
}

// Global limiter — generous enough for legitimate heavy usage, tight enough to block bots
app.use(
  createRateLimiter('global', {
    windowMs: 60 * 1000,   // 1-minute windows
    max: env.RATE_LIMIT.max,
    message: { success: false, message: 'Too many requests, please try again later.' },
  }),
);

// Slow-down repeated requests (sliding penalty) — export for use in route files.
// `name` must be unique per limiter so their counters don't mix.
app.locals.createLimiter = (name, windowMs, max) =>
  createRateLimiter(name, {
    windowMs,
    max,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });

app.get('/', (_req, res) => {
  res.json({ success: true, service: 'digitag-api', version: 'v1' });
});

app.use(env.API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
