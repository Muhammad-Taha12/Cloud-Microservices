const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.label({ label: 'Events Service' }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message, label, functionName }) => {
      return `${timestamp} [${label}] [${functionName || 'unknown'}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: `../../logs/EventLogs.log` })
  ]
});

module.exports = logger;