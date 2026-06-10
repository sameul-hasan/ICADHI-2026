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

    const { campaignId, participantIds } = req.body;
    if (!campaignId || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: "Missing campaignId or participantIds" });
    }

    // Load SMTP Settings
    const smtpDoc = await db.collection("smtpSettings").doc("default").get();
    if (!smtpDoc.exists) {
      return res.status(404).json({ error: "SMTP settings not configured" });
    }
    const smtp = smtpDoc.data();
    const decryptedPassword = decrypt(smtp.encryptedPassword);
    if (!decryptedPassword) {
      return res.status(500).json({ error: "Failed to decrypt SMTP credentials" });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.username,
        pass: decryptedPassword
      }
    });

    // Load Campaign & Template details
    const campaignDoc = await db.collection("emailCampaigns").doc(campaignId).get();
    if (!campaignDoc.exists) {
      return res.status(404).json({ error: "Email campaign not found" });
    }
    const campaign = campaignDoc.data();

    const templateDoc = await db.collection("emailTemplates").doc(campaign.templateId).get();
    if (!templateDoc.exists) {
      return res.status(404).json({ error: "Email template not found" });
    }
    const template = templateDoc.data();

    const batchResults = {};
    let successCount = 0;
    let failureCount = 0;

    for (const participantId of participantIds) {
      try {
        const partDoc = await db.collection("participants").doc(participantId).get();
        if (!partDoc.exists) {
          batchResults[participantId] = { status: "failed", error: "Participant not found." };
          failureCount++;
          continue;
        }
        const p = partDoc.data();

        // Dynamically replace template placeholders
        let htmlContent = template.htmlContent || "";
        htmlContent = htmlContent.replace(/\{\{fullName\}\}/g, p.fullName || "");
        htmlContent = htmlContent.replace(/\{\{email\}\}/g, p.email || "");
        htmlContent = htmlContent.replace(/\{\{institution\}\}/g, p.institution || "");
        htmlContent = htmlContent.replace(/\{\{registrationType\}\}/g, p.registrationType || "");
        const qrCodeImgUrl = p.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId, secureToken: p.uniqueToken || `ICADHI-2026-LOCAL-${participantId}` }))}`;
        htmlContent = htmlContent.replace(/\{\{qrCode\}\}/g, `<img src="${qrCodeImgUrl}" width="150" alt="Registration QR Code" style="display:block; margin: 15px auto;" />`);
        htmlContent = htmlContent.replace(/\{\{eventName\}\}/g, "ICADHI 2026");

        await transporter.sendMail({
          from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
          to: p.email,
          subject: template.subject || "Your ICADHI 2026 Registration QR Code",
          html: htmlContent
        });

        // Update participant document
        await db.collection("participants").doc(participantId).update({
          emailSent: true,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchResults[participantId] = { status: "sent", sentAt: new Date().toISOString() };
        successCount++;
      } catch (err) {
        console.error(`Email send failure for ${participantId}:`, err);
        batchResults[participantId] = { status: "failed", error: err.message, failedAt: new Date().toISOString() };
        failureCount++;
      }
    }

    // Update campaign aggregates inside a transaction
    await db.runTransaction(async (transaction) => {
      const freshCampaignDoc = await transaction.get(db.collection("emailCampaigns").doc(campaignId));
      if (!freshCampaignDoc.exists) return;
      const cData = freshCampaignDoc.data();
      
      const currentResults = cData.results || {};
      const updatedResults = { ...currentResults, ...batchResults };
      
      const sentCount = (cData.sentCount || 0) + successCount;
      const failedCount = (cData.failedCount || 0) + failureCount;
      
      let status = "sending";
      if (sentCount + failedCount >= cData.totalRecipients) {
        status = "completed";
      }

      transaction.update(db.collection("emailCampaigns").doc(campaignId), {
        results: updatedResults,
        sentCount,
        failedCount,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Write audit log
    await db.collection("auditLogs").add({
      userId: uid,
      userEmail: decodedToken.email || "unknown",
      userRole: role,
      action: "Emails Sent",
      details: `Processed batch for campaign ${campaignId} (${successCount} succeeded, ${failureCount} failed) via Vercel`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || "unknown",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, successCount, failureCount });
  } catch (err) {
    console.error("Vercel Campaign Batch error:", err);
    return res.status(500).json({ error: err.message });
  }
};
