const admin = require('firebase-admin');

// Firebase Admin setup.
// Credentials come from the FIREBASE_SERVICE_ACCOUNT env var (JSON string, for hosting)
// or a local serviceAccountKey.json in the project root (see FIREBASE_SETUP.md).

let serviceAccount;
let isConfigured = false;
let db, auth;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Only try to require if the file exists to avoid crashing
    const fs = require('fs');
    const keyPath = require('path').join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
        serviceAccount = require(keyPath);
    }
  }
} catch (e) {
  console.log("⚠️ Error loading service account:", e.message);
}

if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin initialized successfully");
      db = admin.firestore();
      auth = admin.auth();
      isConfigured = true;
    } catch (error) {
      console.error("❌ Firebase Admin initialization failed:", error);
    }
} else {
    console.log("⚠️ Firebase not configured (missing serviceAccountKey.json). Skipping.");
}

module.exports = { admin, db, auth, isConfigured };
