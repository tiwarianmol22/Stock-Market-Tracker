require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * Shared connection pool for REST API queries.
 * Uses mysql2 promise interface.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'apt_trading',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Creates a dedicated single MySQL connection for ZongJi binlog watcher.
 * ZongJi must NOT share the pool — it holds a long-running REPLICATION connection.
 * @returns {Promise<mysql2.Connection>}
 */
async function createBinlogConnection() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'apt_trading',
  });
  logger.info('[DB]', 'Dedicated binlog connection created.');
  return conn;
}

/**
 * Test the pool connection on startup.
 */
async function testConnection() {
  const conn = await pool.getConnection();
  logger.info('[DB]', 'Connection pool established successfully.');
  conn.release();
}

module.exports = { pool, createBinlogConnection, testConnection };
