const express = require('express');
const router  = express.Router();
const { pool } = require('../db/connection');
const logger  = require('../utils/logger');

const VALID_STATUSES = ['pending', 'shipped', 'delivered'];
const VALID_TYPES    = ['BUY', 'SELL'];
const VALID_EXCHANGE = ['NSE', 'BSE'];

/**
 * GET /api/orders
 * Returns all orders sorted by updated_at DESC.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM orders ORDER BY updated_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('[ROUTE]', 'GET /orders failed', err);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

/**
 * POST /api/orders
 * Insert a new order.
 * Body: { customer_name, product_name, order_type, quantity, price, exchange, status }
 */
router.post('/', async (req, res) => {
  const { customer_name, product_name, order_type = 'BUY',
          quantity = 1, price = 0, exchange = 'NSE', status = 'pending' } = req.body;

  if (!customer_name || !product_name) {
    return res.status(400).json({ success: false, error: 'customer_name and product_name are required' });
  }
  if (!VALID_TYPES.includes(order_type))    return res.status(400).json({ success: false, error: 'Invalid order_type' });
  if (!VALID_EXCHANGE.includes(exchange))   return res.status(400).json({ success: false, error: 'Invalid exchange' });
  if (!VALID_STATUSES.includes(status))     return res.status(400).json({ success: false, error: 'Invalid status' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO orders (customer_name, product_name, order_type, quantity, price, exchange, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customer_name, product_name, order_type, quantity, price, exchange, status]
    );
    logger.info('[ROUTE]', `Order inserted: id=${result.insertId} ${product_name} ${order_type}`);
    res.status(201).json({ success: true, insertId: result.insertId });
  } catch (err) {
    logger.error('[ROUTE]', 'POST /orders failed', err);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Update only the status of an order.
 * Body: { status: 'shipped' }
 */
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ?', [status, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Order not found' });
    logger.info('[ROUTE]', `Order id=${id} status → ${status}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[ROUTE]', `PATCH /orders/${id}/status failed`, err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

/**
 * DELETE /api/orders/:id
 * Remove an order by ID.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM orders WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Order not found' });
    logger.info('[ROUTE]', `Order id=${id} deleted.`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[ROUTE]', `DELETE /orders/${id} failed`, err);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

module.exports = router;
