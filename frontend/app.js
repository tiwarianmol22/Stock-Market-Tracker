const API    = 'http://localhost:3000/api/orders';
const WS_URL = 'ws://localhost:3000';

// ── State ──────────────────────────────────────
let orders = [];
let updateCount = 0;
let reconnectDelay = 1000;
let ws;

// Activity chart data (last 20 ticks)
const activityData = Array(20).fill(0);
let activityBurst = 0;

const SYMBOLS = ['RELIANCE','INFY','TCS','HDFCBANK','WIPRO','SBIN','ICICIBANK','TATASTEEL','NIFTY50','BANKNIFTY'];
const NAMES   = ['Arjun Sharma','Priya Mehta','Rahul Gupta','Sneha Iyer','Vikram Nair','Ananya Singh','Karan Patel','Meera Joshi'];
const PRICES  = { RELIANCE:2945, INFY:1478, TCS:3820, HDFCBANK:1612, WIPRO:456, SBIN:812, ICICIBANK:1245, TATASTEEL:162, NIFTY50:22456, BANKNIFTY:48230 };

const STOCKS_STATE = {
  RELIANCE: { name: 'RELIANCE', price: 2945.60, pct: 1.25, change: 36.40, oldPrice: 2945.60 },
  INFY:     { name: 'INFY',     price: 1478.25, pct: -0.85, change: -12.65, oldPrice: 1478.25 },
  TCS:      { name: 'TCS',      price: 3820.00, pct: 0.95, change: 36.10, oldPrice: 3820.00 },
  HDFCBANK: { name: 'HDFCBANK', price: 1612.40, pct: -0.45, change: -7.30, oldPrice: 1612.40 },
  WIPRO:    { name: 'WIPRO',    price: 456.80,  pct: 1.45, change: 6.55, oldPrice: 456.80 },
  SBIN:     { name: 'SBIN',     price: 812.35,  pct: 0.20, change: 1.60, oldPrice: 812.35 },
  ICICIBANK:{ name: 'ICICIBANK',price: 1245.90, pct: -1.15, change: -14.50, oldPrice: 1245.90 },
  TATASTEEL:{ name: 'TATASTEEL',price: 162.45,  pct: 2.10, change: 3.35, oldPrice: 162.45 }
};

// ── Clock ──────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('en-IN', { timeZone:'Asia/Kolkata', hour12:false }) + ' IST';
}
setInterval(updateClock, 1000);
updateClock();

// ── Chart ──────────────────────────────────────
const ctx = document.getElementById('activityChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: activityData.map(() => ''),
    datasets: [{
      data: activityData,
      borderColor: '#00e5b0',
      backgroundColor: 'rgba(0,229,176,0.08)',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.4,
      fill: true,
    }]
  },
  options: {
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: { display: false, min: 0 }
    }
  }
});

setInterval(() => {
  activityData.shift();
  activityData.push(activityBurst);
  activityBurst = 0;
  chart.update('none');
}, 2000);

// ── WebSocket ───────────────────────────────────
function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    reconnectDelay = 1000;
    setStatus(true);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'order_update') handleOrderUpdate(msg);
  };

  ws.onclose = () => {
    setStatus(false);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  };

  ws.onerror = () => ws.close();
}

function setStatus(live) {
  document.getElementById('statusDot').className  = live ? 'dot live' : 'dot';
  document.getElementById('statusText').textContent = live ? 'LIVE' : 'RECONNECTING...';
}

// ── Handle WS event ────────────────────────────
function handleOrderUpdate(msg) {
  updateCount++;
  activityBurst++;
  document.getElementById('statUpdates').textContent = updateCount;
  addEventEntry(msg);

  if (msg.event === 'INSERT') {
    orders.unshift(msg.data);
    prependRow(msg.data);
  } else if (msg.event === 'UPDATE') {
    const idx = orders.findIndex(o => o.id === msg.data.id);
    if (idx !== -1) orders[idx] = msg.data;
    updateRow(msg.data);
  } else if (msg.event === 'DELETE') {
    orders = orders.filter(o => o.id !== msg.data.id);
    removeRow(msg.data.id);
  }
  updateStats();
}

// ── Fetch initial orders ───────────────────────
async function fetchOrders() {
  try {
    const res = await fetch(API);
    const json = await res.json();
    orders = json.data || [];
    renderTable();
    updateStats();
  } catch (e) {
    console.error('Failed to fetch orders:', e);
  }
}

// ── Render full table ──────────────────────────
function renderTable() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = orders.map(rowHTML).join('');
}

function rowHTML(o) {
  return `<tr id="row-${o.id}">
    <td class="id-cell">#${o.id}</td>
    <td><strong>${o.product_name}</strong></td>
    <td><span class="exchange-tag">${o.exchange}</span></td>
    <td><span class="badge badge-${o.order_type.toLowerCase()}">${o.order_type}</span></td>
    <td>${Number(o.quantity).toLocaleString('en-IN')}</td>
    <td class="price-cell">₹${Number(o.price).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
    <td><span class="badge badge-${o.status}">${o.status}</span></td>
    <td style="color:var(--text-dim);font-size:0.72rem">${o.customer_name}</td>
    <td style="color:var(--text-dim);font-size:0.68rem">${formatTime(o.updated_at)}</td>
  </tr>`;
}

function prependRow(o) {
  const tbody = document.getElementById('ordersTableBody');
  const tr = document.createElement('tr');
  tr.id = `row-${o.id}`;
  tr.className = 'new-row';
  tr.innerHTML = rowHTML(o).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '');
  tbody.prepend(tr);
}

function updateRow(o) {
  const tr = document.getElementById(`row-${o.id}`);
  if (!tr) return;
  tr.innerHTML = rowHTML(o).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '');
  tr.classList.remove('flash');
  void tr.offsetWidth; // reflow
  tr.classList.add('flash');
}

function removeRow(id) {
  const tr = document.getElementById(`row-${id}`);
  if (tr) tr.remove();
}

// ── Stats ─────────────────────────────────────
function updateStats() {
  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statBuy').textContent   = orders.filter(o => o.order_type === 'BUY').length;
  document.getElementById('statSell').textContent  = orders.filter(o => o.order_type === 'SELL').length;
}

// ── Event Feed ────────────────────────────────
const EVENT_ICONS = { INSERT:'➕', UPDATE:'✏️', DELETE:'❌' };

function addEventEntry(msg) {
  const log = document.getElementById('eventLog');
  const div = document.createElement('div');
  div.className = `event-entry ${msg.event}`;
  const symbol = msg.data?.product_name || msg.data?.id || '—';
  const time   = new Date(msg.timestamp).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});
  div.innerHTML = `${EVENT_ICONS[msg.event]} <strong>${symbol}</strong> — ${msg.event}
    <br><span class="event-time">${time} IST</span>`;
  log.prepend(div);
  if (log.children.length > 50) log.lastChild.remove();
}

// ── Controls ─────────────────────────────────
async function addRandomOrder() {
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const basePrice = PRICES[symbol] || 1000;
  const price = (basePrice * (0.97 + Math.random() * 0.06)).toFixed(2);
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: NAMES[Math.floor(Math.random() * NAMES.length)],
      product_name:  symbol,
      order_type:    Math.random() > 0.5 ? 'BUY' : 'SELL',
      quantity:      Math.floor(Math.random() * 200) + 1,
      price,
      exchange:      Math.random() > 0.5 ? 'NSE' : 'BSE',
      status:        'pending',
    }),
  });
}

async function simulateUpdate() {
  const pending = orders.filter(o => o.status === 'pending');
  if (!pending.length) { alert('No pending orders to update.'); return; }
  const o = pending[Math.floor(Math.random() * pending.length)];
  await fetch(`${API}/${o.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'shipped' }),
  });
}

async function submitManualOrder() {
  const symbol   = document.getElementById('fSymbol').value.trim().toUpperCase();
  const customer = document.getElementById('fCustomer').value.trim();
  const qty      = document.getElementById('fQty').value;
  const price    = document.getElementById('fPrice').value;
  const type     = document.getElementById('fType').value;
  const exchange = document.getElementById('fExchange').value;
  if (!symbol || !customer) { alert('Symbol and Customer Name are required.'); return; }
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_name:customer, product_name:symbol, order_type:type, quantity:qty, price, exchange, status:'pending' }),
  });
}

// ── Helpers & Features ──────────────────────────
function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});
}

// ── Theme Manager ──────────────────────────────
function initTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if (toggleBtn) toggleBtn.textContent = '🌙';
  }
}

function toggleTheme() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (document.body.classList.contains('light-theme')) {
    document.body.classList.remove('light-theme');
    if (toggleBtn) toggleBtn.textContent = '🌙';
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.classList.add('light-theme');
    if (toggleBtn) toggleBtn.textContent = '☀️';
    localStorage.setItem('theme', 'light');
  }
}

// ── Indian Market Status Tracker ─────────────────
function checkIndianMarketStatus() {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  const dateMap = {};
  parts.forEach(p => dateMap[p.type] = p.value);
  
  const year = parseInt(dateMap.year);
  const month = parseInt(dateMap.month) - 1; // 0-indexed
  const day = parseInt(dateMap.day);
  const hour = parseInt(dateMap.hour);
  const minute = parseInt(dateMap.minute);
  const second = parseInt(dateMap.second);
  
  const kolkataDate = new Date(year, month, day, hour, minute, second);
  const dayOfWeek = kolkataDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  
  const banner = document.getElementById('marketBanner');
  const badge = document.getElementById('marketBadge');
  const desc = document.getElementById('marketBannerText');
  
  if (!banner || !badge || !desc) return;
  
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  const totalMinutes = hour * 60 + minute;
  const startMinutes = 9 * 60; // 09:00
  const endMinutes = 15 * 60 + 30; // 15:30
  
  const isMarketHours = !isWeekend && (totalMinutes >= startMinutes && totalMinutes < endMinutes);
  
  if (isMarketHours) {
    banner.className = 'market-status-banner open';
    badge.textContent = 'OPEN';
    
    const minsLeft = endMinutes - totalMinutes;
    const hrs = Math.floor(minsLeft / 60);
    const mins = minsLeft % 60;
    desc.innerHTML = `Indian stock markets are active (NSE/BSE). The current trading session closes in <span>${hrs}h ${mins}m</span>.`;
  } else {
    banner.className = 'market-status-banner closed';
    badge.textContent = 'CLOSED';
    
    if (!isWeekend && totalMinutes < startMinutes) {
      const minsToOpen = startMinutes - totalMinutes;
      const hrs = Math.floor(minsToOpen / 60);
      const mins = minsToOpen % 60;
      desc.innerHTML = `Indian stock markets are closed. Today's trading session opens in <span>${hrs}h ${mins}m</span> at 09:00 IST.`;
    } else {
      let daysToNextSession = 1;
      if (dayOfWeek === 5) daysToNextSession = 3; // Fri night -> Mon
      else if (dayOfWeek === 6) daysToNextSession = 2; // Sat -> Mon
      
      desc.innerHTML = `Indian stock markets are closed. Next trading session opens in <span>${daysToNextSession} day(s)</span> at 09:00 IST.`;
    }
  }
}

// ── Indices Live Ticker ──────────────────────────
const INDICES_STATE = {
  nifty:     { name: 'NIFTY 50',   val: 22456.20, change: 124.50,  pct: 0.56,  elId: 'idx-nifty' },
  sensex:    { name: 'SENSEX',     val: 73895.50, change: 412.30,  pct: 0.56,  elId: 'idx-sensex' },
  banknifty: { name: 'NIFTY BANK', val: 48230.15, change: -89.40,  pct: -0.19, elId: 'idx-banknifty' },
  niftyit:   { name: 'NIFTY IT',   val: 34120.40, change: 195.80,  pct: 0.58,  elId: 'idx-niftyit' }
};

function updateIndicesValues() {
  Object.keys(INDICES_STATE).forEach(key => {
    const idx = INDICES_STATE[key];
    const isUp = Math.random() > 0.45;
    const percentChange = (Math.random() * 0.04) / 100;
    const delta = idx.val * percentChange;
    
    const oldVal = idx.val;
    if (isUp) {
      idx.val += delta;
      idx.change += delta;
    } else {
      idx.val -= delta;
      idx.change -= delta;
    }
    idx.pct = (idx.change / (idx.val - idx.change)) * 100;
    
    const el = document.getElementById(idx.elId);
    if (el) {
      const valEl = el.querySelector('.index-value');
      const chgEl = el.querySelector('.index-change');
      
      valEl.textContent = idx.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      const chgSign = idx.change >= 0 ? '+' : '';
      const formattedChg = idx.change.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const formattedPct = idx.pct.toFixed(2);
      
      chgEl.textContent = `${chgSign}${formattedChg} (${chgSign}${formattedPct}%)`;
      
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth; // reflow
      
      if (idx.val > oldVal) {
        el.classList.add('flash-up');
        chgEl.className = 'index-change positive';
      } else {
        el.classList.add('flash-down');
        chgEl.className = 'index-change negative';
      }
    }
  });
}

// ── Gainers & Losers Ticker ──────────────────────
function tickStockPrices() {
  Object.keys(STOCKS_STATE).forEach(symbol => {
    const stock = STOCKS_STATE[symbol];
    stock.oldPrice = stock.price;
    
    const isUp = Math.random() > 0.48;
    const percentChange = (Math.random() * 0.08) / 100;
    const delta = stock.price * percentChange;
    
    if (isUp) {
      stock.price += delta;
      stock.change += delta;
    } else {
      stock.price -= delta;
      stock.change -= delta;
    }
    
    const initialPrice = stock.price - stock.change;
    stock.pct = (stock.change / initialPrice) * 100;
  });
  
  renderGainersLosers();
}

function renderGainersLosers() {
  const stocksArray = Object.keys(STOCKS_STATE).map(symbol => STOCKS_STATE[symbol]);
  const sorted = [...stocksArray].sort((a, b) => b.pct - a.pct);
  
  const gainers = sorted.slice(0, 4);
  const losers = sorted.slice(-4).reverse();
  
  const renderList = (containerId, items) => {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;
    
    tbody.innerHTML = items.map(stock => {
      const isPositive = stock.change >= 0;
      const chgSign = isPositive ? '+' : '';
      const colorClass = isPositive ? 'positive' : 'negative';
      const arrow = isPositive ? '▲' : '▼';
      
      let flashClass = '';
      if (stock.price > stock.oldPrice) {
        flashClass = 'class="g-l-row-flash-up"';
      } else if (stock.price < stock.oldPrice) {
        flashClass = 'class="g-l-row-flash-down"';
      }
      
      return `<tr ${flashClass}>
        <td><strong>${stock.name}</strong></td>
        <td>₹${stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="index-change ${colorClass}">${arrow} ${chgSign}${stock.pct.toFixed(2)}%</td>
      </tr>`;
    }).join('');
  };
  
  renderList('gainersList', gainers);
  renderList('losersList', losers);
}

// ── Live Stocks Background Scene ──────────────────
class StockBackground {
  constructor() {
    this.canvas = document.getElementById('bg-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.candles = [];
    this.curves = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initElements();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initElements() {
    const numCandles = Math.ceil(window.innerWidth / 60) + 2;
    for (let i = 0; i < numCandles; i++) {
      this.candles.push(this.createCandle(window.innerWidth - i * 60));
    }

    this.curves = [
      {
        yOffset: 0.35 * window.innerHeight,
        amplitude: 55,
        speed: 0.0016,
        color: 'rgba(0, 229, 176, 0.14)',
        phase: 0
      },
      {
        yOffset: 0.65 * window.innerHeight,
        amplitude: 75,
        speed: 0.0011,
        color: 'rgba(255, 64, 96, 0.12)',
        phase: Math.PI
      }
    ];
  }

  createCandle(x) {
    const isUp = Math.random() > 0.45;
    const bodyHeight = 15 + Math.random() * 35;
    const wickHeight = bodyHeight + 8 + Math.random() * 15;
    const yCenter = window.innerHeight * (0.15 + Math.random() * 0.7);

    return {
      x: x,
      y: yCenter,
      w: 6,
      h: bodyHeight,
      wickH: wickHeight,
      isUp: isUp,
      speed: 0.4 + Math.random() * 0.6 // Increased speed for visible movement
    };
  }

  animate() {
    const isDark = !document.body.classList.contains('light-theme');
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid(isDark);
    this.drawTrendlines();
    this.drawCandles(isDark);

    requestAnimationFrame(() => this.animate());
  }

  drawGrid(isDark) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.strokeStyle = isDark ? 'rgba(30, 48, 80, 0.15)' : 'rgba(150, 170, 200, 0.18)';
    ctx.lineWidth = 1;

    const hStep = 80;
    for (let y = 0; y < h; y += hStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const wStep = 120;
    for (let x = 0; x < w; x += wStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  drawTrendlines() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    this.curves.forEach(curve => {
      curve.phase += curve.speed;
      ctx.beginPath();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = curve.color;

      for (let x = 0; x < w; x += 15) {
        const y = curve.yOffset + Math.sin(x * 0.002 + curve.phase) * curve.amplitude + Math.cos(x * 0.004 - curve.phase * 0.6) * (curve.amplitude * 0.25);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });
  }

  drawCandles(isDark) {
    const ctx = this.ctx;
    
    for (let i = this.candles.length - 1; i >= 0; i--) {
      const c = this.candles[i];
      c.x -= c.speed;

      if (c.x < -50) {
        this.candles.splice(i, 1);
        this.candles.push(this.createCandle(this.canvas.width + 50));
        continue;
      }

      const greenBody = isDark ? 'rgba(0, 229, 176, 0.12)' : 'rgba(0, 180, 130, 0.08)';
      const greenWick = isDark ? 'rgba(0, 229, 176, 0.28)' : 'rgba(0, 180, 130, 0.22)';
      const redBody   = isDark ? 'rgba(255, 64, 96, 0.12)' : 'rgba(220, 50, 70, 0.08)';
      const redWick   = isDark ? 'rgba(255, 64, 96, 0.28)' : 'rgba(220, 50, 70, 0.22)';

      const bodyColor = c.isUp ? greenBody : redBody;
      const wickColor = c.isUp ? greenWick : redWick;

      // Draw Wick with higher opacity
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - c.wickH / 2);
      ctx.lineTo(c.x, c.y + c.wickH / 2);
      ctx.stroke();

      // Draw Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
    }
  }
}

// ── Boot ─────────────────────────────────────────
initTheme();
new StockBackground();
fetchOrders();
connect();
checkIndianMarketStatus();
updateIndicesValues();
tickStockPrices();

// Start background updates for market open status, indices, and stock prices
setInterval(checkIndianMarketStatus, 15000); // Check market status every 15s
setInterval(updateIndicesValues, 3000);       // Fluctuate indices every 3s
setInterval(tickStockPrices, 3000);           // Fluctuate stock prices every 3s


