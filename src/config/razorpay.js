const Razorpay = require('razorpay');
const env = require('./env');

const razorpay = new Razorpay({
  key_id: env.RAZORPAY.keyId,
  key_secret: env.RAZORPAY.keySecret,
});

module.exports = razorpay;
