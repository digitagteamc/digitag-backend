const winston = require('winston');

const level = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProduction ? winston.format.json() : winston.format.prettyPrint(),
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
