require('dotenv').config();
const ZongJi = require('@vlasky/zongji').default;
const { broadcastToAll } = require('./wsServer');
const logger = require('../utils/logger');

const DB_NAME = process.env.DB_NAME || 'apt_trading';
const TABLE   = 'orders';

/**
 * Maps ZongJi event names to readable event types.
 */
const EVENT_MAP = {
  writerows:  'INSERT',
  updaterows: 'UPDATE',
  deleterows: 'DELETE',
};

/**
 * Starts the MySQL binlog watcher using ZongJi.
 * Listens only for changes on the `orders` table and broadcasts to WebSocket clients.
 *
 * Prerequisites — MySQL must have:
 *   log_bin        = ON
 *   binlog_format  = ROW
 *   binlog_row_image = FULL
 * And the DB user needs: GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'user'@'host';
 */
function startBinlogWatcher() {
  const zongji = new ZongJi({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  zongji.on('ready', () => {
    logger.info('[BINLOG]', 'ZongJi binlog watcher started. Listening for order changes...');
  });

  zongji.on('binlog', (event) => {
    const eventType = EVENT_MAP[event.getTypeName()?.toLowerCase()];
    if (!eventType) return;

    // Filter to our table only
    const tableMap = event.tableMap;
    if (!tableMap) return;
    const tableId = Object.keys(tableMap).find(
      (id) => tableMap[id].parentSchema === DB_NAME && tableMap[id].tableName === TABLE
    );
    if (!tableId) return;

    const rows = event.rows || [];

    rows.forEach((row) => {
      let data, previous = null;

      if (eventType === 'UPDATE') {
        previous = row.before;
        data     = row.after;
      } else {
        data = row;
      }

      broadcastToAll({
        type:      'order_update',
        event:     eventType,
        timestamp: new Date().toISOString(),
        data,
        previous,
      });
    });
  });

  zongji.on('error', (err) => {
    logger.error('[BINLOG]', 'ZongJi error. Check MySQL binlog config:', err);
    logger.warn('[BINLOG]', 'MySQL requirements: log_bin=ON, binlog_format=ROW, binlog_row_image=FULL');
    logger.warn('[BINLOG]', 'Grant: GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO your_user;');
  });

  zongji.start({
    includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
    includeSchema: { [DB_NAME]: [TABLE] },
  });

  return zongji;
}

module.exports = { startBinlogWatcher };
