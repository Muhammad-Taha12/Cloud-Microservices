const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.label({ label: 'Booking Service' }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message, label, functionName }) => {
      return `${timestamp} [${label}] [${functionName || 'unknown'}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: `../../logs/BookingLogs.log` })
  ]
});

module.exports = logger;