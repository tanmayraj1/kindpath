import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Use the environment variable for live/production
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Fallback for local development
      credential = admin.credential.cert(require('../../../firebase-service-account.json'));
    }

    admin.initializeApp({
      credential,
      databaseURL: "https://kindpath-a0e86.firebaseio.com"
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
