const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

/**
 * Attaches a WebSocketServer to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {WebSocketServer}
 */
function createWSS(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    logger.info('[WSS]', `Client connected. Total: ${clients.size}`);

    // Send welcome handshake
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'APT Live Order Feed Active',
      timestamp: new Date().toISOString(),
    }));

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('[WSS]', `Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      logger.error('[WSS]', 'Client error:', err);
      clients.delete(ws);
    });
  });

  logger.info('[WSS]', 'WebSocket server attached.');
  return wss;
}

/**
 * Broadcast a JSON payload to all connected WebSocket clients.
 * @param {object} payload
 */
function broadcastToAll(payload) {
  const message = JSON.stringify(payload);
  let sent = 0;
  for (const ws of clients) {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
      sent++;
    }
  }
  logger.info('[WSS]', `Broadcast to ${sent}/${clients.size} clients — event: ${payload.event || payload.type}`);
}

module.exports = { createWSS, broadcastToAll };
