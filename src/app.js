const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
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
app.use(express.json({ limit: '5mb' }));
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
  rateLimit({
    windowMs: 60 * 1000,   // 1-minute windows
    max: env.RATE_LIMIT.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  }),
);

// Slow-down repeated requests (sliding penalty) — export for use in route files
app.locals.createLimiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });

app.get('/', (_req, res) => {
  res.json({ success: true, service: 'digitag-api', version: 'v1' });
});

app.use(env.API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
