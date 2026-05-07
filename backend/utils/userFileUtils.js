const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./encryption');

const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() {
  try {
    const encrypted = fs.readFileSync(USERS_FILE, 'utf8');
    if (!encrypted) return [];
    return JSON.parse(decrypt(encrypted));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  const encrypted = encrypt(JSON.stringify(users));
  fs.writeFileSync(USERS_FILE, encrypted);
}

module.exports = { readUsers, writeUsers };
