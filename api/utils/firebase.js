const admin = require("firebase-admin");

if (!admin.apps.length) {
  let cert = null;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
  } catch (err) {
    console.error("Firebase Service Account credentials parsing failed:", err);
  }

  if (cert) {
    admin.initializeApp({
      credential: admin.credential.cert(cert)
    });
  } else {
    // Local emulator or standard GCP metadata fallback
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "icadhi-2026"
    });
  }
}

const db = admin.firestore();
module.exports = { admin, db };
