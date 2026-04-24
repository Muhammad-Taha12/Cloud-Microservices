require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
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

app.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, availability FROM events');
    logger.info('Retrieved all events successfully', { functionName: 'GET /events' });
    res.json(result.rows);
  } catch (err) {
    logger.error(`Error in GET /events: ${err.message}`, { functionName: 'GET /events' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/events', async (req, res) => {
  const { name, availability } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO events (name, availability) VALUES ($1, $2) RETURNING id, name, availability',
      [name, availability]
    );
    logger.info(`Added new event with id ${result.rows[0].id}`, { functionName: 'POST /events' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error(`Error in POST /events: ${err.message}`, { functionName: 'POST /events' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/events/:eventId/availability', async (req, res) => {
  const { eventId } = req.params;
  try {
    const result = await pool.query('SELECT availability FROM events WHERE id = $1', [eventId]);
    if (result.rows.length === 0) {
      logger.info(`Event ${eventId} not found`, { functionName: 'GET /events/:eventId/availability' });
      return res.status(404).json({ error: 'Event not found' });
    }
    logger.info(`Retrieved availability for event ${eventId}`, { functionName: 'GET /events/:eventId/availability' });
    res.json({ availability: result.rows[0].availability });
  } catch (err) {
    logger.error(`Error in GET /events/:eventId/availability: ${err.message}`, { functionName: 'GET /events/:eventId/availability' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    logger.info(`Deleted event with id ${id}`, { functionName: 'DELETE /events/:id' });
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    logger.error(`Error in DELETE /events/:id: ${err.message}`, { functionName: 'DELETE /events/:id' });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log('Events backend running on port ${PORT}');
  logger.info(`Events backend running on port ${PORT}`, { functionName: 'app.listen' });
});
