const admin = require('../src/config/firebase');

const sendTestNotification = async (fcmToken) => {
  try {
    const message = {
      token: fcmToken,
      notification: {
        title: 'DigiTag Test!',
        body: 'This is a test notification from Firebase Admin.',
      },
      data: {
        type: 'CHAT',
        id: 'test-chat-123'
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Pass the FCM token as a command line argument
const token = process.argv[2];
if (!token) {
  console.log('Please provide an FCM token. Usage: node sendNotification.js <token>');
  process.exit(1);
}

sendTestNotification(token);
