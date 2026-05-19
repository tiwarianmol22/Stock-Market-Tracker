require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const DB_NAME = process.env.DB_NAME || 'apt_trading';

const SEED_ORDERS = [
  { customer_name: 'Arjun Sharma',   product_name: 'RELIANCE',   order_type: 'BUY',  quantity: 50,  price: 2945.60, exchange: 'NSE', status: 'delivered' },
  { customer_name: 'Priya Mehta',    product_name: 'INFY',       order_type: 'SELL', quantity: 100, price: 1478.25, exchange: 'BSE', status: 'shipped'   },
  { customer_name: 'Rahul Gupta',    product_name: 'TCS',        order_type: 'BUY',  quantity: 25,  price: 3820.00, exchange: 'NSE', status: 'pending'   },
  { customer_name: 'Sneha Iyer',     product_name: 'HDFCBANK',   order_type: 'BUY',  quantity: 75,  price: 1612.40, exchange: 'NSE', status: 'delivered' },
  { customer_name: 'Vikram Nair',    product_name: 'WIPRO',      order_type: 'SELL', quantity: 200, price: 456.80,  exchange: 'BSE', status: 'pending'   },
  { customer_name: 'Ananya Singh',   product_name: 'SBIN',       order_type: 'BUY',  quantity: 150, price: 812.35,  exchange: 'NSE', status: 'shipped'   },
  { customer_name: 'Karan Patel',    product_name: 'ICICIBANK',  order_type: 'SELL', quantity: 60,  price: 1245.90, exchange: 'BSE', status: 'delivered' },
  { customer_name: 'Meera Joshi',    product_name: 'TATASTEEL',  order_type: 'BUY',  quantity: 300, price: 162.45,  exchange: 'NSE', status: 'pending'   },
  { customer_name: 'Dev Malhotra',   product_name: 'NIFTY50',    order_type: 'BUY',  quantity: 10,  price: 22456.00,exchange: 'NSE', status: 'shipped'   },
  { customer_name: 'Riya Choudhary', product_name: 'BANKNIFTY',  order_type: 'SELL', quantity: 5,   price: 48230.50,exchange: 'BSE', status: 'delivered' },
];

/**
 * Initialises the database: creates DB, table, and seeds data if empty.
 */
async function initDB() {
  // Connect without specifying DB first (to create it if needed)
  const tempConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await tempConn.query(`USE \`${DB_NAME}\``);
  logger.info('[DB]', `Database '${DB_NAME}' ready.`);

  await tempConn.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(100) NOT NULL,
      product_name  VARCHAR(100) NOT NULL,
      order_type    ENUM('BUY','SELL') NOT NULL DEFAULT 'BUY',
      quantity      INT NOT NULL DEFAULT 1,
      price         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      exchange      ENUM('NSE','BSE') NOT NULL DEFAULT 'NSE',
      status        ENUM('pending','shipped','delivered') NOT NULL DEFAULT 'pending',
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  logger.info('[DB]', 'Table `orders` ready.');

  const [rows] = await tempConn.execute('SELECT COUNT(*) as cnt FROM orders');
  if (rows[0].cnt === 0) {
    for (const order of SEED_ORDERS) {
      await tempConn.execute(
        `INSERT INTO orders (customer_name, product_name, order_type, quantity, price, exchange, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [order.customer_name, order.product_name, order.order_type,
         order.quantity, order.price, order.exchange, order.status]
      );
    }
    logger.info('[DB]', `Seeded ${SEED_ORDERS.length} sample orders.`);
  }

  await tempConn.end();
}

module.exports = { initDB };
