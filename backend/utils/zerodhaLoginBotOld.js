require('dotenv').config();
const puppeteer = require('puppeteer');
const { authenticator } = require('otplib');
const storeLog = require("../logger");

async function autoLoginZerodha(user) {
  const ZERODHA_LOGIN_URL = `https://kite.trade/connect/login?v=3&api_key=${user.api_key}`;
  const user_id = user.user_id;
  const password = user.password;
  const totp_key = user.totp_secret;

  const browser = await puppeteer.launch({
    headless: true, // set to true in production
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  let requestToken = null;

  try {
    const page = await browser.newPage();

    // Intercept URL to get request_token
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const match = url.match(/request_token=([\w-]+)/);
      if (match && !requestToken) {
        requestToken = match[1];
        storeLog('Captured request_token from redirect: ' + requestToken);
      }
      req.continue();
    });

    // Also listen to navigation events (backup)
    page.on('framenavigated', frame => {
      const url = frame.url();
      const match = url.match(/request_token=([\w-]+)/);
      if (match && !requestToken) {
        requestToken = match[1];
        storeLog('Captured request_token from navigation: ' + requestToken);
      }
    });

    storeLog('Navigating to Zerodha login...');
    await page.goto(ZERODHA_LOGIN_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Login Step
    await page.waitForSelector('input#userid', { timeout: 20000 });
    await page.type('input#userid', user_id);
    await page.type('input#password', password);
    await page.click('button[type="submit"]');

    // TOTP Step
    await page.waitForSelector('input[placeholder="••••••"]', { timeout: 20000 });
    const totp = authenticator.generate(totp_key);
    await page.type('input[placeholder="••••••"]', totp);

    // Submit and wait for redirect
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
    ]);

    // If requestToken not yet captured, poll the URL as last fallback
    let retries = 10;
    while (!requestToken && retries-- > 0) {
      const url = page.url();
      const match = url.match(/request_token=([\w-]+)/);
      if (match) {
        requestToken = match[1];
        storeLog('Captured request_token from page URL: ' + requestToken);
        break;
      }
      await new Promise(res => setTimeout(res, 1000)); // wait 1 sec
    }

    if (requestToken) {
      // storeLog('Zerodha Login Successful!');
      await browser.close();
      return requestToken;
    } else {
      throw new Error('Request token not found after login');
    }
  } catch (err) {
    storeLog('Zerodha login failed: ' + err.message);
    await browser.close();
    throw err;
  }
}

module.exports = autoLoginZerodha;
