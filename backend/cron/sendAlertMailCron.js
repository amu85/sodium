const { sendAlertMail } = require('../utils/mailer');

const runSendAlertMail = async () => {
  const email = process.env.SEND_ALERT_EMAIL_ID;
  if (!email) {
    throw new Error('Unauthorized email');
  }

  await sendAlertMail(email);
};

module.exports = runSendAlertMail;