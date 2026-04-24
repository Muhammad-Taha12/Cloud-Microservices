require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const amqp = require('amqplib');
const axios = require('axios');
const logger = require('./logger');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.get('/bookings', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, user_id, event_id, tickets, status, availability, cost FROM bookings');
    logger.info('Retrieved all bookings successfully', { functionName: 'GET /bookings' });
    res.json(result.rows);
  } catch (err) {
    logger.error(`Error in GET /bookings: ${err.message}`, { functionName: 'GET /bookings' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/bookings', async (req, res) => {
  const { user_id, event_id, tickets } = req.body;
  const availability = true;
  const cost = tickets * 10;
  try {
    logger.info(`Attempting to create booking for user_id: ${user_id}, event_id: ${event_id}`, { functionName: 'POST /bookings' });

    // FIX: Use K8s service name instead of localhost
    const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://event-service:5001';
    const eventAvailabilityUrl = `${EVENT_SERVICE_URL}/events/${event_id}/availability`;
    logger.info(`Checking event availability via ${eventAvailabilityUrl}`, { functionName: 'POST /bookings' });
    const eventResponse = await axios.get(eventAvailabilityUrl);
    if (!eventResponse.data.availability) {
      logger.info(`Event ${event_id} is not available`, { functionName: 'POST /bookings' });
      return res.status(400).json({ error: 'Event not available' });
    }

    const existing = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 AND event_id = $2',
      [user_id, event_id]
    );

    if (existing.rows.length > 0) {
      logger.info(`Booking already exists for user_id: ${user_id} and event_id: ${event_id}`, { functionName: 'POST /bookings' });
      const updatedResult = await pool.query(
        'UPDATE bookings SET status = $1 WHERE user_id = $2 AND event_id = $3 RETURNING *',
        ['confirmed', user_id, event_id]
      );
      const updatedBooking = updatedResult.rows[0];

      const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [user_id]);
      const username = userRes.rows[0].username;

      await publishBookingConfirmation({
        booking_id: updatedBooking.id,
        username: username,
        status: 'CONFIRMED'
      });
      logger.info(`Booking already existed. Updated status to confirmed for booking id ${updatedBooking.id}`, { functionName: 'POST /bookings' });
      return res.status(400).json({
        error: 'Booking already exists for this event. Status updated to confirmed.'
      });
    }

    const result = await pool.query(
      'INSERT INTO bookings (user_id, event_id, tickets, availability, cost, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [user_id, event_id, tickets, availability, cost, 'pending']
    );
    logger.info(`Created new booking with id ${result.rows[0].id}`, { functionName: 'POST /bookings' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error(`Error in POST /bookings: ${err.message}`, { functionName: 'POST /bookings' });
    res.status(500).json({ error: err.message });
  }
});

app.patch('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    logger.info(`Attempting to update booking id ${id} to status ${status}`, { functionName: 'PATCH /bookings/:id' });
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      logger.info(`Booking id ${id} not found`, { functionName: 'PATCH /bookings/:id' });
      return res.status(404).json({ error: 'Booking not found' });
    }
    const updatedBooking = result.rows[0];

    if (status.toLowerCase() === 'confirmed') {
      const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [updatedBooking.user_id]);
      const username = userRes.rows[0].username;
      await publishBookingConfirmation({
        booking_id: updatedBooking.id,
        username: username,
        status: 'CONFIRMED'
      });
      logger.info(`Updated booking id ${id} to confirmed and published event`, { functionName: 'PATCH /bookings/:id' });
    }
    res.json(updatedBooking);
  } catch (err) {
    logger.error(`Error in PATCH /bookings/:id: ${err.message}`, { functionName: 'PATCH /bookings/:id' });
    res.status(500).json({ error: err.message });
  }
});

async function publishBookingConfirmation(event) {
  try {
    // FIX: Use K8s service name instead of localhost
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    const queue = 'booking_confirmed';

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(event)), { persistent: true });
    logger.info(`Published booking confirmation event: ${JSON.stringify(event)}`, { functionName: 'publishBookingConfirmation' });
    await channel.close();
    await connection.close();
  } catch (error) {
    logger.error(`Error publishing booking confirmation: ${error.message}`, { functionName: 'publishBookingConfirmation' });
  }
}

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  logger.info(`Booking backend running on port ${PORT}`, { functionName: 'app.listen' });
});
