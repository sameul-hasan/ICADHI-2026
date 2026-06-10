const { db, admin } = require("./utils/firebase");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'icadhi-2026-secret-key-32chars!';

function decrypt(text) {
  try {
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.createHash('sha256').update(String(SECRET_KEY)).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}

module.exports = async (req, res) => {
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
    if (role !== "super_admin" && role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Permissions required" });
    }

    // Load SMTP credentials
    const smtpDoc = await db.collection("smtpSettings").doc("default").get();
    if (!smtpDoc.exists) {
      return res.status(404).json({ error: "SMTP settings not configured" });
    }

    const settings = smtpDoc.data();
    const decryptedPassword = decrypt(settings.encryptedPassword);
    if (!decryptedPassword) {
      return res.status(500).json({ error: "Failed to decrypt SMTP credentials" });
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      auth: {
        user: settings.username,
        pass: decryptedPassword
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    await transporter.verify();
    return res.status(200).json({ success: true, message: "SMTP connection verified successfully!" });
  } catch (err) {
    console.error("SMTP connection test failure:", err);
    return res.status(500).json({ error: err.message });
  }
};
