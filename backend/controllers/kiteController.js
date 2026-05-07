const fs = require('fs');
const path = require('path');
const { KiteConnect, KiteTicker } = require("kiteconnect");
const { readUsers, writeUsers } = require("../utils/userFileUtils");
const autoLoginZerodha = require("../utils/zerodhaLoginBot");
const storeLog = require('../logger');
const { getLTP, filterInstruments, getUniqueInstrumentOptions, getISTDateTime } = require('../services/kiteService');

const INSTRUMENTS_FILE = path.join(__dirname, '../data/instruments.json');

exports.autoLoginAndFetchToken = async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });

  const users = readUsers();
  const userIndex = users.findIndex(u => u.user_id == userId);
  if (userIndex === -1) return res.status(404).json({ message: 'User not found' });

  const user = users[userIndex];

  try {
    const requestToken = await autoLoginZerodha(user);

    const kc = new KiteConnect({ api_key: user.api_key });
    const session = await kc.generateSession(requestToken, user.api_secret);

    users[userIndex].access_token = session.access_token;
    users[userIndex].access_token_date = new Date().toISOString();
    users[userIndex].public_token = session.public_token;
    writeUsers(users);

    res.json({ success: true, message: 'Token saved', user: users[userIndex] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Auto login failed', error: error.message });
  }
};

exports.getInstrumentsFromKite = async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });

  const users = readUsers();
  const user = users.find(u => u.user_id == userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const kc = new KiteConnect({ api_key: user.api_key });
    kc.setAccessToken(user.access_token);

    const instruments = await kc.getInstruments();

    // Save instruments into JSON file
    const jsonPath = path.join(__dirname, '..', 'data', 'instruments.json');
    fs.writeFileSync(jsonPath, JSON.stringify(instruments, null, 2), "utf-8");

    res.json({ success: true, message: 'Instruments saved to instruments.json', count: instruments.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch instruments', error: error.message });
  }
};

exports.instruments = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, ...filters } = req.query;
    const instruments = filterInstruments(filters);

    const total = instruments.length;
    const start = (page - 1) * pageSize;
    const paginated = instruments.slice(start, start + parseInt(pageSize));

    res.json({
      success: true,
      count: total,
      instruments: paginated,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to load instruments", error: error.message });
  }
};

exports.getUniqueInstrumentOptions = async (req, res) => {
  try {
    const filters = req.query;
    const result = getUniqueInstrumentOptions(filters);
    res.json({ success: true, uniqueOptions: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get unique options",
      error: error.message,
    });
  }
};

exports.getUserInstrumentOptions = async (req, res) => {
  try {
    if (!fs.existsSync(INSTRUMENTS_FILE)) {
      return res.status(404).json({ success: false, message: 'Instruments file not found' });
    }

    const data = fs.readFileSync(INSTRUMENTS_FILE, 'utf8');
    let instruments = JSON.parse(data);

    let { tradingsymbols } = req.query;
    if (!tradingsymbols) {
      return res.json({ success: true, uniqueOptions: {} });
    }

    if (!Array.isArray(tradingsymbols)) {
      tradingsymbols = [tradingsymbols];
    }
    const tsLower = tradingsymbols.map(ts => ts.toLowerCase());

    instruments = instruments.filter(inst =>
      inst.tradingsymbol && tsLower.includes(inst.tradingsymbol.toLowerCase())
    );

    const uniqueOptions = {
      instrumentTypes: {},
      names: {},
      expiries: {},
    };

    instruments.forEach(inst => {
      const ts = inst.tradingsymbol;

      // instrumentTypes - tradingsymbols
      if (inst.instrument_type) {
        if (!uniqueOptions.instrumentTypes[inst.instrument_type]) {
          uniqueOptions.instrumentTypes[inst.instrument_type] = [];
        }
        uniqueOptions.instrumentTypes[inst.instrument_type].push(ts);
      }

      // names - tradingsymbols
      if (inst.name) {
        if (!uniqueOptions.names[inst.name]) {
          uniqueOptions.names[inst.name] = [];
        }
        uniqueOptions.names[inst.name].push(ts);
      }

      // expiries - tradingsymbols
      if (inst.expiry) {
        const date = new Date(inst.expiry);
        if (!isNaN(date)) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const formatted = `${day}-${month}-${year}`;

          if (!uniqueOptions.expiries[formatted]) {
            uniqueOptions.expiries[formatted] = [];
          }
          uniqueOptions.expiries[formatted].push(ts);
        }
      }
    });

    res.json({ success: true, uniqueOptions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user instrument options', error: error.message });
  }
};

exports.getUserFunds = async (req, res) => {
  const users = readUsers();

  // Load instruments and make a lookup map
  const data = fs.readFileSync(INSTRUMENTS_FILE, 'utf8');
  const instruments = JSON.parse(data);
  const instrumentMap = {};
  for (const inst of instruments) {
    instrumentMap[inst.instrument_token] = {
      lot_size: inst.lot_size,
      name: inst.name,
    };
  }

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    users[i].available_funds = '';
    users[i].fund_last_updated_at = '';
    users[i].holdings = [];
    users[i].positions = { net: [] };

    try {
      // storeLog(`User fund : ${user.user_id}`);
      const kc = new KiteConnect({ api_key: user.api_key });
      kc.setAccessToken(user.access_token);

      // Get margins/funds
      const margins = await kc.getMargins();
      users[i].available_funds = (margins.equity?.net || 0);
      users[i].fund_last_updated_at = getISTDateTime();

      // Get Holdings
      let holdings = await kc.getHoldings();
      holdings = holdings.map(h => ({
        ...h,
        lot_size: instrumentMap[h.instrument_token]?.lot_size || 1,
        name: instrumentMap[h.instrument_token]?.name || '',
      }));
      users[i].holdings = holdings;

      // Get Positions
      let positions = await kc.getPositions();
      positions.net = positions.net.map(p => ({
        ...p,
        lot_size: instrumentMap[p.instrument_token]?.lot_size || 1,
        name: instrumentMap[p.instrument_token]?.name || '',
      }));
      users[i].positions = positions;

    } catch (err) {
      storeLog(`Failed for user fund ${user.user_id}: ${err.message}`);
    }
  }

  writeUsers(users);
  res.json({ success: true, users });
};

exports.getLTPFromKite = async (req, res) => {
  const { user_id, instruments } = req.body;
  if (!user_id) return res.status(400).json({ message: 'Missing user_id' });
  if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
    return res.status(400).json({ message: "Missing instruments array" });
  }

  try {
    const ltp = await getLTP(user_id, instruments);
    res.json({ success: true, ltp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQuoteFromKite = async (req, res) => {
  const userId = req.body.user_id;
  const instruments = req.body.instruments;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });
  if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
    return res.status(400).json({ message: "Missing instruments array" });
  }

  const users = readUsers();
  const user = users.find(u => u.user_id == userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const kc = new KiteConnect({ api_key: user.api_key });
    kc.setAccessToken(user.access_token);

    const quotes = await kc.getQuote(instruments);
    res.json({ success: true, quotes: quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch instruments', error: error.message });
  }
};

let ticker = null;
let subscribers = []; // SSE clients
exports.startTicker = (req, res) => {
  const { user_id, instruments } = req.body;

  if (!user_id || !Array.isArray(instruments) || instruments.length === 0) {
    return res.status(400).json({ message: "Missing user_id or instruments" });
  }

  const users = readUsers();
  const user = users.find((u) => u.user_id == user_id);
  if (!user || !user.api_key || !user.access_token) return res.status(404).json({ message: "User not found" });

  try {
    if (!ticker) {
      // console.log("Starting ticker for:", user_id);
      ticker = new KiteTicker({
        api_key: user.api_key,
        access_token: user.access_token,
      });

      ticker.connect();

      ticker.on("connect", () => {
        console.log("Ticker connected");
      });

      ticker.on("ticks", (ticks) => {
        // Push live ticks to all SSE clients
        subscribers.forEach((res) =>
          res.write(`data: ${JSON.stringify(ticks)}\n\n`)
        );
      });

      ticker.on("error", (err) => {
        console.error("Ticker error:", err.message);
      });
    }

    const tokens = instruments.map(Number);
    ticker.subscribe(tokens);
    ticker.setMode(ticker.modeFull, tokens);

    res.json({ success: true, tokens });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to start ticker",
      error: err.message,
    });
  }
};

// SSE endpoint
exports.ticksStream = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // console.log("SSE client connected");
  subscribers.push(res);

  // Heartbeat every 20s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(":\n\n"); // SSE comment = heartbeat
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscribers = subscribers.filter((s) => s !== res);
    // console.log("SSE client disconnected");
  });
};

exports.executeOrder = async (req, res) => {
  try {
    const { users, instruments } = req.body;
    // console.log(instruments); return false;

    if (!users?.length || !instruments?.length) {
      return res.status(400).json({ success: false, message: 'No users or instruments provided' });
    }

    const storedUsers = readUsers();
    const results = [];

    // Loop user wise
    for (const u of users) {

      const userRecord = storedUsers.find(user => user.id == u.id);
      if (!userRecord || !userRecord.access_token) {
        results.push({ id: u.id, success: false, error: 'No valid access token' });
        continue;
      }

      const kc = new KiteConnect({ api_key: userRecord.api_key });
      kc.setAccessToken(userRecord.access_token);

      // Now loop instruments and place orders
      for (const inst of instruments) {
        try {
          let product_type = '';
          if(inst.exchange === "BFO" || inst.exchange === "NFO") {
            product_type = 'NRML';
          } else if(inst.exchange === "BSE" || inst.exchange === "NSE") {
            product_type = 'CNC';
          }

          if(product_type !== '') {
            let orderParams = {
              exchange: inst.exchange,
              tradingsymbol: inst.tradingsymbol,
              transaction_type: inst.type.toUpperCase(), // BUY / SELL
              quantity: u.qty,
              product: product_type, // or MIS / CNC / NRML
              order_type: u.orderType.toUpperCase(),
              validity: kc.VALIDITY_DAY,
            }
            if(u.orderType == 'limit') {
              orderParams.price = u.limit_price
            }
            const orderResp = await kc.placeOrder(kc.VARIETY_REGULAR, orderParams);

            results.push({
              userId: u.id,
              name: userRecord.name,
              instrument: inst.tradingsymbol,
              order_id: orderResp.order_id,
              success: true,
            });
          }
        } catch (err) {
          results.push({
            userId: u.id,
            name: userRecord.name,
            instrument: inst.tradingsymbol,
            success: false,
            error: err.message,
          });
        }
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('executeOrder error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.closeExistingOrder = async (req, res) => {
  try {
    const userData = req.body;
    // console.log(userData); return false;

    if (!userData || Object.keys(userData).length === 0) {
      return res.status(400).json({ success: false, message: 'No user instruments provided' });
    }

    const storedUsers = readUsers();
    const results = [];

    // Loop user wise
    for (const [id, userRow] of Object.entries(userData)) {
      if (!userRow.user || !userRow.instruments || userRow.instruments.length === 0) {
        results.push({ id: id, success: false, error: 'No user or instruments provided' });
        continue;
      }

      const userRecord = storedUsers.find(u => String(u.id) === String(userRow.user.user_id));
      if (!userRecord || !userRecord.access_token) {
        results.push({ id: id, success: false, error: 'No valid access token' });
        continue;
      }

      const kc = new KiteConnect({ api_key: userRecord.api_key });
      kc.setAccessToken(userRecord.access_token);

      // Now loop instruments and place orders
      for (const inst of userRow.instruments) {
        try {
          let transaction_type = '';
          let quantity = Math.abs(inst.close_quantity);

          if (inst.exchange === "BFO" || inst.exchange === "NFO") {
            transaction_type = inst.type.toUpperCase(); // BUY / SELL
          } else if (inst.exchange === "BSE" || inst.exchange === "NSE") {
            transaction_type = "SELL";
          }

          const orderParams = {
            exchange: inst.exchange,
            tradingsymbol: inst.tradingsymbol,
            transaction_type: transaction_type,
            quantity: quantity,
            product: inst.product,
            order_type: userRow.user.orderType?.toUpperCase() || "MARKET",
            validity: kc.VALIDITY_DAY,
          };
          if(userRow.user.orderType == 'limit') {
            orderParams.price = inst.close_price
          }
          const orderResp = await kc.placeOrder(kc.VARIETY_REGULAR, orderParams);

          results.push({
            userId: userRow.user.id,
            name: userRecord.name,
            instrument: inst.tradingsymbol,
            order_id: orderResp.order_id,
            success: true,
          });

        } catch (err) {
          results.push({
            userId: userRow.user.id,
            name: userRecord.name,
            instrument: inst.tradingsymbol,
            success: false,
            error: err.message,
          });
        }
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('executeOrder error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getOrders = async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });

  const users = readUsers();
  const user = users.find(u => u.user_id == userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const kc = new KiteConnect({ api_key: user.api_key });
    kc.setAccessToken(user.access_token);

    // Fetch all orders of this user
    const orders = await kc.getOrders();

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

exports.getOrderHistory = async (req, res) => {
  const userId = req.query.user_id;
  const orderId = req.query.order_id;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });

  const users = readUsers();
  const user = users.find(u => u.user_id == userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const kc = new KiteConnect({ api_key: user.api_key });
    kc.setAccessToken(user.access_token);

    const orderHistory = await kc.getOrderHistory(orderId);
    res.json({ success: true, orderHistory: orderHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch order history', error: error.message });
  }
};

exports.cancelRegularOrder = async (req, res) => {
  const userId = req.body.user_id;
  const orderId = req.body.order_id;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });

  const users = readUsers();
  const user = users.find(u => u.user_id == userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const kc = new KiteConnect({ api_key: user.api_key });
    kc.setAccessToken(user.access_token);

    const order = await kc.cancelOrder(kc.VARIETY_REGULAR, orderId);
    res.json({ success: true, order: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cancelling regular order', error: error.message });
  }
};

exports.modifyRegularOrder = async (req, res) => {
  const userId = req.body.user_id;
  const orderId = req.body.order_id;
  const price = req.body.price;
  if (!userId) return res.status(400).json({ message: 'Missing user_id' });

  const users = readUsers();
  const user = users.find(u => u.user_id == userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  try {
    const kc = new KiteConnect({ api_key: user.api_key });
    kc.setAccessToken(user.access_token);

    const order = await kc.modifyOrder(kc.VARIETY_REGULAR, orderId, {
      price: price
    });
    res.json({ success: true, order: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error modify regular order', error: error.message });
  }
};
