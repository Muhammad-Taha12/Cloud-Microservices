const amqp = require('amqplib');
const http = require('http');
const socketIo = require('socket.io');
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.label({ label: 'Notification Service' }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message, label, functionName }) => {
      return `${timestamp} [${label}] [${functionName || 'unknown'}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/app/logs/NotificationLogs.log' })
  ]
});

const server = http.createServer((req, res) => {
  res.end('Notification Service Running');
});

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

server.listen(5003, () => {
  logger.info('Socket.io server listening on port 5003', { functionName: 'server.listen' });
});

async function startNotificationService() {
  // FIX: Use K8s service name instead of localhost
  const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
  let retries = 10;

  while (retries > 0) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      const queue = 'booking_confirmed';
      await channel.assertQueue(queue, { durable: true });
      logger.info(`Waiting for messages in queue: ${queue}`, { functionName: 'startNotificationService' });

      channel.consume(queue, (msg) => {
        if (msg !== null) {
          const event = JSON.parse(msg.content.toString());
          logger.info(`Received booking confirmation event: ${JSON.stringify(event)}`, { functionName: 'channel.consume' });

          sendConfirmationEmail(event);
          io.emit('notification', event);
          channel.ack(msg);
        }
      });
      break; // Connected successfully
    } catch (error) {
      retries--;
      logger.error(`Error connecting to RabbitMQ (${retries} retries left): ${error.message}`, { functionName: 'startNotificationService' });
      if (retries === 0) throw error;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function sendConfirmationEmail(event) {
  logger.info(`Sending confirmation email to ${event.username} for booking ${event.booking_id} with status ${event.status}`, { functionName: 'sendConfirmationEmail' });
}

startNotificationService();
