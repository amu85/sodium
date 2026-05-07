
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const usersPath = path.join(__dirname, '../data/auths.json');
const users = JSON.parse(fs.readFileSync(usersPath)).users || [];

exports.login = (req, res) => {
  const userIdInput = req.body.userId ?? req.body.user_id;
  const { password } = req.body;

  console.log(`[AUTH] Login attempt for user: ${userIdInput}`);

  if (!userIdInput || !password) {
    return res.status(400).json({ success: false, message: 'userId and password are required' });
  }

  // Load users every time to ensure fresh data
  const currentUsers = JSON.parse(fs.readFileSync(usersPath)).users || [];
  const matchedUser = currentUsers.find(
    (user) => user.userId.toLowerCase() === userIdInput.toLowerCase() && user.password === password
  );

  if (!matchedUser) {
    console.log(`[AUTH] Login failed for: ${userIdInput}`);
    return res.status(401).json({ success: false, message: 'Invalid userId or password' });
  }

  console.log(`[AUTH] Login successful: ${userIdInput}`);
  const token = jwt.sign({ userId: matchedUser.userId }, JWT_SECRET, { expiresIn: '24h' });
  return res.json({ success: true, message: 'Login successful', token });
};

exports.logout = (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    req.app.get('tokenBlacklist').add(token);
  }

  res.json({ success: true, message: 'Logged out successfully. Token blacklisted.' });
};

exports.JWT_SECRET = JWT_SECRET;
