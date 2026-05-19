const express = require('express');
const cors    = require('cors');
const path    = require('path');
const ordersRouter = require('./routes/orders');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'APT Real-Time Orders' }));

// Routes
app.use('/api/orders', ordersRouter);

module.exports = app;
