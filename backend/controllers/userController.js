const { readUsers, writeUsers } = require('../utils/userFileUtils');

exports.getUsers = (req, res) => {
  const users = readUsers();
  const { include_inactive } = req.query;

  let filteredUsers = users;
  if (include_inactive === "true") {
    filteredUsers = users;
  } else {
    filteredUsers = users.filter(user => user.is_active);
  }

  res.json(filteredUsers);
};

exports.getUserById = (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json(user);
};

exports.createUser = (req, res) => {
  const users = readUsers();
  const newUser = {
    id: Date.now(),
    name: req.body.name,
    email: req.body.email,
    api_key: req.body.api_key,
    api_secret: req.body.api_secret,
    user_id: req.body.user_id,
    password: req.body.password,
    totp_secret: req.body.totp_secret || '',
    server_ip: req.body.server_ip || '',
    trading_funds: req.body.trading_funds
      ? parseInt(req.body.trading_funds, 10)
      : 0,
    is_compound: req.body.is_compound || false,
    is_active: req.body.is_active || false,
    public_token: req.body.public_token || '',
  };
  users.push(newUser);
  writeUsers(users);
  res.status(201).json({ success: true, message: 'User created.', user: newUser });
};

exports.updateUser = (req, res) => {
  const users = readUsers();
  const index = users.findIndex(u => u.id == req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'User not found' });

  const updatedData = { ...req.body };
  if (updatedData.trading_funds !== undefined) {
    updatedData.trading_funds = parseInt(updatedData.trading_funds, 10) || 0;
  }
  users[index] = { ...users[index], ...updatedData };
  writeUsers(users);
  res.json({ success: true, message: 'User updated.', user: users[index] });
};

exports.deleteUser = (req, res) => {
  const users = readUsers();
  const updatedUsers = users.filter(u => u.id != req.params.id);
  if (updatedUsers.length === users.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  writeUsers(updatedUsers);
  res.json({ success: true, message: 'User deleted.' });
};
