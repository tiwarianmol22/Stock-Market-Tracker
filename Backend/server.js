require('dotenv').config();
const http = require('http');
const app  = require('./src/app');
const { initDB } = require('./src/db/init');
const { pool }   = require('./src/db/connection');
const { createWSS }    = require('./src/realtime/wsServer');
const { startBinlogWatcher } = require('./src/realtime/binlogWatcher');
const logger = require('./src/utils/logger');

const PORT = parseInt(process.env.PORT) || 3000;

/**
 * Bootstrap the entire APT backend:
 * 1. Initialise DB schema + seed data
 * 2. Verify pool connection
 * 3. Create HTTP server with Express
 * 4. Attach WebSocket server
 * 5. Start ZongJi binlog CDC watcher
 * 6. Listen on configured PORT
 */
async function bootstrap() {
  console.log(`
\x1b[32m
  ╔═══════════════════════════════════════╗
  ║   APT — ATYPICAL TECHNOLOGIES PVT LTD ║
  ║   Live Order Feed  |  Real-Time CDC   ║
  ╚═══════════════════════════════════════╝
\x1b[0m`);

  // 1. Init DB schema + seed
  await initDB();

  // 2. Test pool
  const conn = await pool.getConnection();
  logger.info('[DB]', 'Pool connection verified.');
  conn.release();

  // 3. Create HTTP + Express server
  const httpServer = http.createServer(app);

  // 4. Attach WebSocket server
  createWSS(httpServer);

  // 5. Start binlog watcher
  startBinlogWatcher();

  // 6. Listen
  httpServer.listen(PORT, () => {
    logger.info('[SERVER]', `REST API  → http://localhost:${PORT}/api/orders`);
    logger.info('[SERVER]', `WebSocket → ws://localhost:${PORT}`);
    logger.info('[SERVER]', `Health    → http://localhost:${PORT}/health`);
    logger.info('[SERVER]', 'APT Live Feed is LIVE. Watching MySQL binlog...');
  });
}

bootstrap().catch((err) => {
  console.error('\x1b[31m[FATAL] Startup failed:\x1b[0m', err.message);
  console.error('Check your .env credentials and MySQL binlog configuration.');
  process.exit(1);
});
