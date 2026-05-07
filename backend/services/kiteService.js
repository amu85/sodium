const { KiteConnect } = require("kiteconnect");
const { readUsers } = require("../utils/userFileUtils");
const fs = require("fs");
const path = require("path");

const INSTRUMENTS_FILE = path.join(__dirname, "../data/instruments.json");

async function getUserKiteInstance(userId) {
  const users = readUsers();
  const user = users.find((u) => u.user_id == userId);
  if (!user) throw new Error("User not found");

  const kc = new KiteConnect({ api_key: user.api_key });
  kc.setAccessToken(user.access_token);
  return kc;
}

async function getLTP(userId, instruments) {
  const kc = await getUserKiteInstance(userId);
  return kc.getLTP(instruments);
}

async function getMargins(userId) {
  const kc = await getUserKiteInstance(userId);
  return kc.getMargins();
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getUniqueInstrumentOptions(filters = {}) {
  if (!fs.existsSync(INSTRUMENTS_FILE)) {
    throw new Error("Instruments file not found");
  }

  const data = fs.readFileSync(INSTRUMENTS_FILE, "utf8");
  let instruments = JSON.parse(data);

  // Apply filters (same logic as controller)
  instruments = instruments.filter((inst) => {
    for (const key in filters) {
      if (!filters[key]) continue;

      let val = inst[key];
      let filterVal = filters[key];

      if (key === "expiry") {
        const date = new Date(val);
        if (!isNaN(date)) {
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          val = `${day}-${month}-${year}`;
        }
      }

      if (Array.isArray(filterVal)) {
        if (
          !filterVal.some(
            (fv) => String(val).toLowerCase() === String(fv).toLowerCase()
          )
        ) {
          return false;
        }
      } else {
        if (String(val).toLowerCase() !== String(filterVal).toLowerCase()) {
          return false;
        }
      }
    }
    return true;
  });

  // Build unique lists
  const uniqueValues = {
    exchange: new Set(),
    segment: new Set(),
    instrument_type: new Set(),
    name: new Set(),
    expiry: new Set(),
    tradingsymbol: new Set(),
    strike: new Set(),
  };

  instruments.forEach((inst) => {
    if (inst.exchange) uniqueValues.exchange.add(inst.exchange);
    if (inst.segment) uniqueValues.segment.add(inst.segment);
    if (inst.instrument_type) uniqueValues.instrument_type.add(inst.instrument_type);
    if (inst.name) uniqueValues.name.add(inst.name);
    if (inst.expiry) uniqueValues.expiry.add(inst.expiry);
    if (inst.tradingsymbol) uniqueValues.tradingsymbol.add(inst.tradingsymbol);
    if (inst.strike) uniqueValues.strike.add(inst.strike);
  });

  const result = {};
  for (const key in uniqueValues) {
    result[key] = Array.from(uniqueValues[key]).sort();
  }

  return result;
}

function filterInstruments(filters = {}) {
  if (!fs.existsSync(INSTRUMENTS_FILE)) {
    throw new Error("Instruments file not found");
  }

  const data = fs.readFileSync(INSTRUMENTS_FILE, "utf8");
  let instruments = JSON.parse(data);

  instruments = instruments.filter((inst) => {
    for (const key in filters) {
      if (!filters[key]) continue;

      const filterVal = filters[key];
      let instrumentValue = inst[key];

      // Special handling for expiry
      if (key === "expiry" && instrumentValue) {
        instrumentValue = formatDate(instrumentValue);
        if (instrumentValue !== filterVal) return false;
        continue;
      }

      // Normalize values safely
      const instValStr = String(instrumentValue || "").toLowerCase();

      if (Array.isArray(filterVal)) {
        // Compare with any in array safely
        const match = filterVal.some(
          (val) => instValStr === String(val || "").toLowerCase()
        );
        if (!match) return false;
      } else {
        // Compare single value safely
        const filterValStr = String(filterVal || "").toLowerCase();
        if (instValStr !== filterValStr) return false;
      }
    }
    return true;
  });

  return instruments;
}

async function placeOrder(userId, orderData) {
  const kc = await getUserKiteInstance(userId);
  try {
    let orderParams = {
      exchange: orderData.exchange,
      tradingsymbol: orderData.tradingsymbol,
      transaction_type: orderData.transaction_type, // BUY / SELL
      quantity: orderData.quantity,
      product: orderData.product || "NRML", // or MIS / CNC / NRML
      order_type: orderData.order_type || "MARKET",
      validity: kc.VALIDITY_DAY,
    }
    // const orderResp = await kc.placeOrder(kc.VARIETY_REGULAR, orderParams);
    const orderResp = '';

    return { status: "success", data: orderResp };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function getISTDateTime() {
  const now = new Date();
  const options = {
    timeZone: process.env.TZ || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat("en-GB", options);
  const parts = formatter.formatToParts(now);

  const date = `${parts.find(p => p.type === "year").value}-${parts.find(p => p.type === "month").value}-${parts.find(p => p.type === "day").value}`;
  const time = `${parts.find(p => p.type === "hour").value}:${parts.find(p => p.type === "minute").value}:${parts.find(p => p.type === "second").value}`;

  return `${date} ${time}`; // e.g., "2025-11-12 15:42:30"
}

module.exports = {
  getLTP,
  getMargins,
  getUniqueInstrumentOptions,
  filterInstruments,
  placeOrder,
  getISTDateTime,
};
