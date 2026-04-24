require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('./logger');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'Key123';

app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  logger.info(`Attempting registration for username: ${username}`, { functionName: 'POST /register' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    logger.info(`User registered successfully with id: ${result.rows[0].id}`, { functionName: 'POST /register' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error(`Error in POST /register: ${err.message}`, { functionName: 'POST /register' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  logger.info(`Attempting login for username: ${username}`, { functionName: 'POST /login' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      logger.info(`Login failed - User not found: ${username}`, { functionName: 'POST /login' });
      return res.status(400).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.info(`Login failed - Invalid credentials for username: ${username}`, { functionName: 'POST /login' });
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
    logger.info(`User login successful for user id: ${user.id}`, { functionName: 'POST /login' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    logger.error(`Error in POST /login: ${err.message}`, { functionName: 'POST /login' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/dashboard', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    logger.info('Dashboard access denied - Missing Authorization header', { functionName: 'GET /dashboard' });
    return res.status(401).json({ error: 'Access Denied' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    logger.info('Fetching user info for dashboard', { functionName: 'GET /dashboard' });
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await pool.query('SELECT id, username FROM users WHERE id = $1', [decoded.userId]);
    logger.info(`User info retrieved for user id: ${decoded.userId}`, { functionName: 'GET /dashboard' });
    res.json(user.rows[0]);
  } catch (err) {
    logger.error(`Error in GET /dashboard: ${err.message}`, { functionName: 'GET /dashboard' });
    res.status(401).json({ error: 'Invalid Token' });
  }
});

app.listen(PORT, () => {
  logger.info(`Users backend running on port ${PORT}`, { functionName: 'app.listen' });
});
