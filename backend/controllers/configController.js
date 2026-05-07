const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/config.json');

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

exports.getConfig = (req, res) => {
  try {
    const config = readConfig();
    res.json(config);
  } catch (error) {
    res.status(404).json({ success: error, message: 'Failed to read config' });
  }
};

exports.updateConfig = (req, res) => {
  try {
    const existingConfig = readConfig();

    // Extract only keys that can be updated
    const {
      preOpeningTime,
      openingTime,
      closingTime,
      postClosingTime,
      orderMargin,
      sebiRules,
      strikeMultiple,
      perpetualCycle,
      stopLossPer,
      niftyStrategy,
      sensexStrategy,
    } = req.body;

    // Merge old and new data
    const updatedConfig = {
      ...existingConfig, // keep all existing keys
      ...(preOpeningTime !== undefined && { preOpeningTime }),
      ...(openingTime !== undefined && { openingTime }),
      ...(closingTime !== undefined && { closingTime }),
      ...(postClosingTime !== undefined && { postClosingTime }),
      ...(orderMargin !== undefined && { orderMargin }),
      ...(sebiRules !== undefined && { sebiRules }),
      ...(strikeMultiple !== undefined && { strikeMultiple }),
      ...(perpetualCycle !== undefined && { perpetualCycle }),
      ...(stopLossPer !== undefined && { stopLossPer }),
      ...(niftyStrategy !== undefined && {
        niftyStrategy: {
          ...existingConfig.niftyStrategy,
          ...niftyStrategy,
        },
      }),
      ...(sensexStrategy !== undefined && {
        sensexStrategy: {
          ...existingConfig.sensexStrategy,
          ...sensexStrategy,
        },
      }),
    };

    writeConfig(updatedConfig);
    res.json({ success: true, message: 'Configuration updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update config', error: error.message });
  }
};
