const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD
  }
});

function sendOTP(toEmail, otp) {
  return transporter.sendMail({
    from: process.env.MAIL_USERNAME,
    to: toEmail,
    subject: 'Dhruti Algo Login - Your OTP Code',
    html: `<p>Your OTP is: <strong>${otp}</strong></p>`
  });
}

function sendAlertMail(toEmail) {
  return transporter.sendMail({
    from: process.env.MAIL_USERNAME,
    to: toEmail,
    subject: 'Dhruti Algo - Alert',
    html: `<p>Alert: Update user's Treding funds.</p>`
  });
}

module.exports = { sendOTP, sendAlertMail };
