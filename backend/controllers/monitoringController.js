const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/monitoring.json');

function readMonitoring() {
  if (!fs.existsSync(FILE_PATH)) return { monitoringRunning: false };
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = raw ? JSON.parse(raw) : {};
    if (data.monitoringRunning === undefined) data.monitoringRunning = false;
    return data;
  } catch (err) {
    console.error("Error reading monitoring:", err);
    return { monitoringRunning: false };
  }
}

function writeMonitoring(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing monitoring:", err);
  }
}

// GET /api/monitoring
exports.getMonitoring = (req, res) => {
  try {
    const data = readMonitoring();
    res.json({ success: true, Monitoring: data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to read monitoring' });
  }
};

// PUT /api/monitoring — supports bulk instruments
exports.updateMonitoring = (req, res) => {
  try {
    const { instruments } = req.body; // instruments should be an array of instrument objects

    if (!Array.isArray(instruments) || instruments.length === 0) {
      return res.status(400).json({ success: false, message: 'No instruments provided' });
    }

    const data = readMonitoring();

    // Add/update each instrument by its tradingsymbol
    instruments.forEach((inst) => {
      if (inst?.tradingsymbol) {
        data[inst.tradingsymbol] = inst;
      }
    });

    writeMonitoring(data);

    res.json({
      success: true,
      message: `${instruments.length} instruments added/updated`,
      monitoring: data,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update monitoring' });
  }
};

// DELETE /api/monitoring — remove one instrument
exports.deleteMonitoring = (req, res) => {
  try {
    const { instrument } = req.body;

    if (!instrument) {
      return res.status(400).json({ success: false, message: 'Instrument is required' });
    }

    const data = readMonitoring();

    if (!data[instrument]) {
      return res.status(404).json({ success: false, message: 'Instrument not found' });
    }

    delete data[instrument];
    writeMonitoring(data);

    res.json({ success: true, message: `${instrument} removed successfully`, monitoring: data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to delete instrument' });
  }
};

exports.getMonitoringStatus = (req, res) => {
  try {
    const data = readMonitoring();
    res.json({ success: true, monitoringRunning: !!data.monitoringRunning });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to read monitoring status' });
  }
};

exports.updateMonitoringStatus = (req, res) => {
  try {
    const { monitoringRunning } = req.body;

    if (typeof monitoringRunning !== 'boolean') {
      return res.status(400).json({ success: false, message: 'monitoringRunning must be boolean' });
    }

    const data = readMonitoring();
    data.monitoringRunning = monitoringRunning;
    writeMonitoring(data);

    res.json({
      success: true,
      message: `Monitoring is now ${monitoringRunning ? 'running' : 'stopped'}`,
      monitoringRunning,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update monitoring status' });
  }
};
