const { PrismaClient } = require('@prisma/client');
const env = require('./env');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: env.isProduction ? ['error', 'warn'] : ['warn', 'error'],
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
