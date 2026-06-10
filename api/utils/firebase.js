import admin from "firebase-admin";

if (!admin.apps.length) {
  let cert = null;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (cert.private_key) {
        // Fix for Vercel newline escaping on private keys
        cert.private_key = cert.private_key.replace(/\\n/g, '\n');
      }
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

export const db = admin.firestore();
export { admin };
