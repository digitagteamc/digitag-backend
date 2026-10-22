require('dotenv').config();
require('./config/sentry');

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDb, disconnectDb } = require('./config/db');
const { schedulePruneRefreshTokens } = require('./jobs/pruneRefreshTokens');
const { scheduleSendBroadcasts } = require('./jobs/sendScheduledBroadcasts');

async function bootstrap() {
  await connectDb();
  schedulePruneRefreshTokens();
  scheduleSendBroadcasts();

  const server = app.listen(env.PORT, () => {
    logger.info(`DigiTag API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
  // Keep idle connections open longer than the load balancer does (ALB
  // default idle timeout: 60s). With Node's 5s default, Node closes a socket
  // the ALB still considers reusable and the next request on it gets a 502.
  server.keepAliveTimeout = 65 * 1000;
  server.headersTimeout = 66 * 1000;

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down...`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection', { err });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { err });
    shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { err });
  process.exit(1);
});
