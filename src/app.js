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

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT.windowMs,
    max: env.RATE_LIMIT.max,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/', (_req, res) => {
  res.json({ success: true, service: 'digitag-api', version: 'v1' });
});

app.use(env.API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
