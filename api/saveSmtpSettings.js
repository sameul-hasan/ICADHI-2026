import { db, admin } from "./utils/firebase.js";
import crypto from "crypto";

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'icadhi-2026-secret-key-32chars!';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(String(SECRET_KEY)).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // RBAC verification
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: "User profile not found" });
    }
    const role = userDoc.data().role;
    if (role !== "super_admin") {
      return res.status(403).json({ error: "Access Denied: Super Admin permissions required" });
    }

    const { host, port, username, password, fromName, fromEmail } = req.body;
    if (!host || !port || !username || !fromEmail) {
      return res.status(400).json({ error: "Missing required SMTP parameters" });
    }

    const dataToSave = {
      host,
      port: Number(port),
      username,
      fromName: fromName || "ICADHI 2026",
      fromEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (password && password !== "********") {
      dataToSave.encryptedPassword = encrypt(password);
    }

    await db.collection("smtpSettings").doc("default").set(dataToSave, { merge: true });

    // Log audit trail
    await db.collection("auditLogs").add({
      userId: uid,
      userEmail: decodedToken.email || "unknown",
      userRole: "super_admin",
      action: "SMTP Settings Updated",
      details: "Successfully updated custom SMTP settings (via Vercel Serverless)",
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || "unknown",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Save SMTP error:", err);
    return res.status(500).json({ error: err.message });
  }
}
