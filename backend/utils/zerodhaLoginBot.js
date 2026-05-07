require('dotenv').config();
const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { authenticator } = require('otplib');
const storeLog = require("../logger");

// Chrome options
const chromeOptions = new chrome.Options();
chromeOptions.addArguments('--headless');
chromeOptions.addArguments('--disable-gpu');
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');

// ---- Main Zerodha AutoLogin ----
async function autoLoginZerodha(user) {
  const ZERODHA_LOGIN_URL = `https://kite.trade/connect/login?v=3&api_key=${user.api_key}`;
  let driver;

  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    storeLog(`Navigating to Zerodha login for ${user.user_id}...`);
    await driver.get(ZERODHA_LOGIN_URL);
    await driver.sleep(2000);

    // Step 1: userid + password (absolute XPaths like Python)
    const username = await driver.findElement(
      By.xpath('/html/body/div[1]/div/div[2]/div[1]/div/div/div[2]/form/div[1]/input')
    );
    const password = await driver.findElement(
      By.xpath('/html/body/div[1]/div/div[2]/div[1]/div/div/div[2]/form/div[2]/input')
    );
    await username.sendKeys(user.user_id);
    await password.sendKeys(user.password);

    // Click login
    const loginBtn = await driver.findElement(
      By.xpath('/html/body/div[1]/div/div[2]/div[1]/div/div/div[2]/form/div[4]/button')
    );
    await loginBtn.click();
    await driver.sleep(2000);

    // Step 2: TOTP input
    const totpInput = await driver.findElement(
      By.xpath('/html/body/div[1]/div/div[2]/div[1]/div[2]/div/div[2]/form/div[1]/input')
    );
    const totp = authenticator.generate(user.totp_secret);
    await totpInput.sendKeys(totp);
    await driver.sleep(1000);

    // Step 3: Capture request_token
    const currentUrl = await driver.getCurrentUrl();
    const match = currentUrl.match(/request_token=([\w-]+)/);
    if (!match) throw new Error(`Request token not found for ${user.user_id}`);

    const requestToken = match[1];
    storeLog(`Captured request_token for ${user.user_id}: ${requestToken}`);
    return requestToken;

  } catch (err) {
    storeLog(`Zerodha login failed for ${user.user_id}: ${err.message}`);
    throw err;
  } finally {
    if (driver) await driver.quit();
  }
}

module.exports = autoLoginZerodha;
