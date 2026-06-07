const { PrismaClient } = require('@prisma/client');
const env = require('./env');
const logger = require('../utils/logger');

// Append connection pooling params — Prisma reads them from the URL.
// connection_limit: max DB connections per server instance
// pool_timeout: seconds to wait for a free connection before throwing
const dbUrl = env.DATABASE_URL.includes('connection_limit')
  ? env.DATABASE_URL
  : `${env.DATABASE_URL}${env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=${env.DB_CONNECTION_LIMIT}&pool_timeout=10`;

const prisma = new PrismaClient({
  log: env.isProduction ? ['error', 'warn'] : ['warn', 'error'],
  datasources: { db: { url: dbUrl } },
});

async function connectDb() {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error('Database connection failed', { err });
    throw err;
  }
}

async function disconnectDb() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (err) {
    logger.error('Database disconnect failed', { err });
  }
}

module.exports = { prisma, connectDb, disconnectDb };
