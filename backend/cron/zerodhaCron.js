const { KiteConnect } = require("kiteconnect");
const { readUsers, writeUsers } = require("../utils/userFileUtils");
const autoLoginZerodha = require("../utils/zerodhaLoginBot");
const fs = require("fs");
const path = require("path");
const storeLog = require("../logger");

const runAutoLoginForAllUsers = async () => {
  const users = readUsers();
  let instrumentsFetched = false;

  // Today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    // Check if user already logged in today
    let tokenDate = user.access_token_date ? new Date(user.access_token_date) : null;
    let tokenDay = tokenDate ? tokenDate.toISOString().split("T")[0] : null;

    if (tokenDay === today && user.access_token) {
      storeLog(`Skipping login for user ${user.user_id}, already logged in today.`);
      continue;
    }

    // Reset tokens before trying login
    users[i].access_token = '';
    users[i].access_token_date = '';
    users[i].public_token = '';

    try {
      storeLog(`Logging in user: ${user.user_id}`);

      const requestToken = await autoLoginZerodha(user);
      const kc = new KiteConnect({ api_key: user.api_key });
      const session = await kc.generateSession(requestToken, user.api_secret);

      users[i].access_token = session.access_token;
      users[i].access_token_date = new Date().toISOString();
      users[i].public_token = session.public_token;

      storeLog(`Token updated for user ${user.user_id}`);

      // Fetch instruments only once
      if (!instrumentsFetched) {
        const instruments = await kc.getInstruments();

        // Save instruments into JSON file
        const jsonPath = path.join(__dirname, '..', 'data', 'instruments.json');
        fs.writeFileSync(jsonPath, JSON.stringify(instruments, null, 2), "utf-8");
        storeLog("Instruments data saved.");
        instrumentsFetched = true;
      }

    } catch (err) {
      storeLog(`Failed for user ${user.user_id}: ${err.message}`);
    }
  }

  writeUsers(users);
};

module.exports = runAutoLoginForAllUsers;
