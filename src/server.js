require('dotenv').config();

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDb, disconnectDb } = require('./config/db');

async function bootstrap() {
  await connectDb();

  const server = app.listen(env.PORT, () => {
    logger.info(`DigiTag API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

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
