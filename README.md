# APT — Real-Time Order Monitor
Atypical Technologies Pvt Ltd | Stock Market Tracker

A production-style real-time order tracking system where clients receive instant updates whenever data in the MySQL database changes — with zero polling.

---

## Architecture

```
┌──────────────┐    REST POST/PATCH/DELETE    ┌─────────────────┐
│   Browser    │ ──────────────────────────▶  │  Express REST   │
│  (index.html)│                              │  API :3000      │
│              │ ◀──── WebSocket (ws://) ───  └────────┬────────┘
└──────────────┘                                       │ writes to
                                                       ▼
                                               ┌───────────────┐
                                               │  MySQL DB     │
                                               │  orders table │
                                               └───────┬───────┘
                                                       │ binary log
                                                       ▼
                                               ┌───────────────┐
                                               │  ZongJi CDC   │
                                               │  Binlog Watch │
                                               └───────┬───────┘
                                                       │ broadcastToAll()
                                                       ▼
                                               ┌───────────────┐
                                               │  WebSocket    │
                                               │  Server (ws)  │
                                               └───────────────┘
```

No polling anywhere. Every update flows: DB write → binlog → ZongJi → WebSocket → Browser.

---

## Why This Approach?

| Approach | Latency | DB Load | Missed Events | Scalability |
|---|---|---|---|---|
| Polling | High (~N sec) | High (constant queries) | Possible | Poor |
| DB Triggers + Queue | Medium | Medium | Rare | Good |
| CDC via Binlog (this project) | Very Low (~ms) | Near zero | None | Excellent |

CDC (Change Data Capture) reads MySQL's binary replication log — the same log MySQL replicas use. It captures every INSERT/UPDATE/DELETE at the DB engine level, before the transaction even commits to disk. No extra DB load, no missed events, true real-time.

WebSocket was chosen over SSE or long-polling because it provides full-duplex, low-overhead persistent connections — ideal for a trading terminal where both the server and client may need to exchange data rapidly.

Scalability path: To scale horizontally, replace `broadcastToAll()` with a Redis Pub/Sub publisher. Each server instance subscribes to the same Redis channel and broadcasts to its own connected clients. This is the standard pattern used in production trading platforms.

---

## Stock Market Specific Features

This project goes beyond the base assignment by adding fields that reflect real NSE/BSE order book structure:

| Field | Values | Why It Matters |
|---|---|---|
| `order_type` | BUY / SELL | Core to every exchange order |
| `exchange` | NSE / BSE | Indian equity market segments |
| `quantity` | integer | Number of shares/lots |
| `price` | DECIMAL(10,2) | Price per share in INR (₹) |

The UI uses real Indian stock symbols (RELIANCE, INFY, TCS, HDFCBANK, BANKNIFTY, NIFTY50 etc.) and displays a live IST clock — matching the NSE market hours feel (9:15 AM – 3:30 PM IST).

---

## MySQL Setup (Required)

### 1. Enable Binary Logging

Edit your MySQL config file (`/etc/mysql/my.cnf` on Linux, `C:\ProgramData\MySQL\MySQL Server 8.x\my.ini` on Windows):

```ini
[mysqld]
log_bin            = ON
binlog_format      = ROW
binlog_row_image   = FULL
server_id          = 1
```

Restart MySQL after editing:
```bash
sudo systemctl restart mysql
```

### 2. Grant Replication Privileges

```sql
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Verify Binlog is Active

```sql
SHOW VARIABLES LIKE 'log_bin';
-- Should return: log_bin | ON
SHOW VARIABLES LIKE 'binlog_format';
-- Should return: binlog_format | ROW
```

---

## Installation & Running

### Prerequisites
- Node.js v18+
- MySQL 8.x with binlog enabled (see above)

### Steps

```bash
# 1. Clone / enter project
cd apt-realtime-orders/backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Start the server
npm start
# or for development with auto-reload:
npm run dev
```

The server will:
- Auto-create the `apt_trading` database and `orders` table
- Seed 10 sample orders on first run
- Start the WebSocket server on the same port

### 5. Open the frontend

```bash
# Just open in your browser — no build needed
open frontend/index.html
# or double-click index.html in your file explorer
```

---

## API Reference

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/api/orders` | — | Fetch all orders (newest first) |
| POST | `/api/orders` | `{customer_name, product_name, order_type, quantity, price, exchange, status}` | Create new order |
| PATCH | `/api/orders/:id/status` | `{status}` | Update order status only |
| DELETE | `/api/orders/:id` | — | Delete an order |
| GET | `/health` | — | Health check |

### Status values: `pending` · `shipped` · `delivered`
### order_type values: `BUY` · `SELL`
### exchange values: `NSE` · `BSE`

---

## How Real-Time Works (Step by Step)

1. User clicks "+ Random Order" in the browser → `POST /api/orders`
2. Express writes the row to MySQL
3. MySQL writes the change to its binary log
4. ZongJi (running as a MySQL replica listener) detects the new binlog event
5. ZongJi fires a `writerows` event in Node.js with the full row data
6. `broadcastToAll()` sends a WebSocket message to every connected browser
7. The browser receives the JSON, animates a new row into the order book table in real time

Total latency: typically < 50ms from DB write to browser update.
