const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/freezeLimits.json');

function readFreezeLimits() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Error reading freezeLimits:", err);
    return {};
  }
}

function writeFreezeLimits(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing freezeLimits:", err);
  }
}

// GET /api/freeze-limits
exports.getfreezeLimits = (req, res) => {
  try {
    const data = readFreezeLimits();
    res.json({ success: true, freezeLimits: data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to read freeze limits' });
  }
};

// PUT /api/freeze-limits
exports.updatefreezeLimits = (req, res) => {
  try {
    const { instrumentName, limit } = req.body;

    if (!instrumentName || typeof limit !== "number") {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const data = readFreezeLimits();
    data[instrumentName] = limit; // Add or update
    writeFreezeLimits(data);

    res.json({ success: true, updated: { instrumentName, limit } });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update freeze limits' });
  }
};
