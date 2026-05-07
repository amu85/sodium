require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const configRoutes = require('./routes/configRoutes');
const kiteRoutes = require('./routes/kiteRoutes');
const freezeLimitsRoutes = require('./routes/freezeLimitsRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const algoRoutes = require('./routes/algoRoutes');
const futuresStrategyRoutes = require('./routes/futuresStrategyRoutes');
const intradayRoutes = require('./routes/intradayRoutes');
const paperRoutes = require('./routes/paperRoutes');
const { JWT_SECRET } = require('./controllers/authController');
const cron = require('node-cron');
const runAutoLoginForAllUsers = require('./cron/zerodhaCron');
const runSendAlertMail = require('./cron/sendAlertMailCron');
const storeLog = require('./logger');
const { scheduleExitTimeCheck, readConfig, startAlgoInternal } = require('./controllers/algoController');
const { autoStartEnabledStrategies } = require('./utils/autoStartStrategies');

const app = express();

const frontendOrigin = (process.env.REACT_FRONTEND_API || 'http://localhost:3001').replace(
  /^['"]|['"]$/g,
  ''
);

// CORS setup for frontend
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));

app.options('*', cors({
  origin: frontendOrigin,
  credentials: true,
}));

app.use(bodyParser.json());

// Token blacklist
const tokenBlacklist = new Set();
app.set('tokenBlacklist', tokenBlacklist);

// Auth routes
app.use('/api/auth', authRoutes);

// Protected routes
app.get('/api/test', authenticateJWT, (req, res) => {
  res.json({ success: true, message: 'You have access to this protected test API.', user: req.user });
});
app.use('/api/users', authenticateJWT, userRoutes);
app.use('/api/config', authenticateJWT, configRoutes);
app.use('/api/zerodha', authenticateJWT, kiteRoutes);
app.use('/api/freeze-limits', authenticateJWT, freezeLimitsRoutes);
app.use('/api/monitoring', authenticateJWT, monitoringRoutes);
app.use('/api/intraday', authenticateJWT, intradayRoutes);
app.use('/api/paper', authenticateJWT, paperRoutes);

// Auto Algo route
app.use('/api/algo', algoRoutes);

// Futures Strategy routes
app.use('/api/futures-strategy', futuresStrategyRoutes);

app.get('/api/run-cron-manual-login', async (req, res) => {
  try {
    await runAutoLoginForAllUsers();
    res.json({ success: true, message: 'Auto login for all users completed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Cron failed', error: error.message });
  }
});

app.get('/api/run-cron-manual-send-alert-mail', async (req, res) => {
  try {
    await runSendAlertMail();
    res.json({ success: true, message: 'Alert mail sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Mail send failed', error: error.message });
  }
});

// JWT Middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];
  if (req.app.get('tokenBlacklist').has(token)) {
    return res.status(403).json({ message: 'Token is blacklisted. Please login again.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Schedule to run every day at 7:30, 7:45, and 8:00
["30 7 * * *", "45 7 * * *", "0 8 * * *"].forEach((time) => {
  cron.schedule(time, async () => {
    storeLog(`[CRON ${time}] Starting auto-login for all Zerodha users...`);

    try {
      await runAutoLoginForAllUsers();
      storeLog("Auto-login for all users completed successfully.");

      await autoStartEnabledStrategies();
    } catch (error) {
      storeLog(`[CRON ${time}] Auto-login failed: ${error.stack || error.message}`);
    }
  });
});

(async () => {
  storeLog("Server started. Checking for strategies to auto-start...");
  await autoStartEnabledStrategies();

})();

scheduleExitTimeCheck();

// Schedule to run every month on the 25th at 08:00
cron.schedule('0 8 25 * *', async () => {
  storeLog("Sending alert mail...");
  try {
    await runSendAlertMail();
    storeLog("Alert mail sent successfully.");
  } catch (error) {
    storeLog("Mail send failed: " + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
