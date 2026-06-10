const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const crypto = require("crypto");

admin.initializeApp();

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'icadhi-2026-secret-key-32chars!';

// Helper: Encrypt SMTP password
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(String(SECRET_KEY)).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Helper: Decrypt SMTP password
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

// Helper: Write Audit Log
async function logAudit(userId, userEmail, userRole, action, details, ipAddress) {
  try {
    await admin.firestore().collection("auditLogs").add({
      userId,
      userEmail,
      userRole: userRole || "unknown",
      action,
      details,
      ipAddress: ipAddress || "unknown",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// Helper: Check RBAC Roles
async function checkUserRole(uid, allowedRoles) {
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("unauthenticated", "User profile not found.");
  }
  const role = userDoc.data().role;
  if (!allowedRoles.includes(role)) {
    throw new HttpsError("permission-denied", "Unauthorized access.");
  }
  return role;
}

/**
 * 1. Trigger: Generate QR Code on Participant Creation
 */
exports.onParticipantCreated = onDocumentCreated("participants/{participantId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return;
  }
  const participantId = event.params.participantId;
  const data = snapshot.data();

  // If already has uniqueToken and qrCodeUrl, skip to avoid loops
  if (data.uniqueToken && data.qrCodeUrl) {
    return;
  }

  try {
    // Generate secure token
    const secureToken = `ICADHI-2026-${crypto.randomUUID()}`;
    
    // Generate QR Code containing participantId and secureToken
    const qrData = JSON.stringify({
      participantId: participantId,
      secureToken: secureToken
    });

    const qrBuffer = await QRCode.toBuffer(qrData, {
      type: 'png',
      margin: 2,
      width: 300
    });

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(`qrcodes/${participantId}.png`);
    
    await file.save(qrBuffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      }
    });

    // Make public so it can be viewed in browser and embedded in emails
    await file.makePublic();
    const qrCodeUrl = `https://storage.googleapis.com/${bucket.name}/qrcodes/${participantId}.png`;

    // Update participant doc
    await admin.firestore().collection("participants").doc(participantId).update({
      uniqueToken: secureToken,
      qrCodeUrl: qrCodeUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Successfully generated QR code and updated participant: ${participantId}`);
  } catch (err) {
    console.error(`Error generating QR code for ${participantId}:`, err);
  }
});

/**
 * 2. Callable: Save SMTP Settings (Super Admin only)
 */
exports.saveSmtpSettings = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  
  // Verify user is Super Admin
  await checkUserRole(uid, ["super_admin"]);

  const { host, port, username, password, fromName, fromEmail } = request.data;
  
  if (!host || !port || !username || !fromEmail) {
    throw new HttpsError("invalid-argument", "Missing required SMTP parameters.");
  }

  const dataToSave = {
    host,
    port: Number(port),
    username,
    fromName: fromName || "ICADHI 2026",
    fromEmail,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // Only update password if a new one is provided (not masked)
  if (password && password !== "********") {
    dataToSave.encryptedPassword = encrypt(password);
  }

  await admin.firestore().collection("smtpSettings").doc("default").set(dataToSave, { merge: true });

  // Log audit event
  await logAudit(
    uid,
    request.auth.token.email,
    "super_admin",
    "SMTP Settings Updated",
    "Successfully updated custom SMTP settings",
    request.rawRequest?.ip || ""
  );

  return { success: true };
});

/**
 * 3. Callable: Test SMTP Connection (Admin/Super Admin only)
 */
exports.testSmtpConnection = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  
  // Verify Admin or Super Admin
  await checkUserRole(uid, ["super_admin", "admin"]);

  // Retrieve default settings
  const doc = await admin.firestore().collection("smtpSettings").doc("default").get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "SMTP settings not configured.");
  }

  const settings = doc.data();
  const decryptedPassword = decrypt(settings.encryptedPassword);
  if (!decryptedPassword) {
    throw new HttpsError("internal", "Failed to decrypt SMTP credentials.");
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.username,
      pass: decryptedPassword
    },
    // Add timeouts to prevent hanging
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });

  try {
    await transporter.verify();
    return { success: true, message: "SMTP connection verified successfully!" };
  } catch (error) {
    console.error("SMTP Test failed:", error);
    return { success: false, error: error.message };
  }
});

/**
 * 4. Callable: Send Email Campaign Batch (Admin/Super Admin only)
 * Receives campaignId and array of participantIds to process in a batch.
 */
exports.sendCampaignBatch = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  
  const role = await checkUserRole(uid, ["super_admin", "admin"]);

  const { campaignId, participantIds } = request.data;
  if (!campaignId || !Array.isArray(participantIds) || participantIds.length === 0) {
    throw new HttpsError("invalid-argument", "Missing campaignId or participantIds.");
  }

  // Load SMTP
  const smtpDoc = await admin.firestore().collection("smtpSettings").doc("default").get();
  if (!smtpDoc.exists) {
    throw new HttpsError("not-found", "SMTP settings not configured. Configure settings before launching campaigns.");
  }
  const smtp = smtpDoc.data();
  const decryptedPassword = decrypt(smtp.encryptedPassword);
  if (!decryptedPassword) {
    throw new HttpsError("internal", "Failed to decrypt SMTP credentials.");
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

  // Load campaign & template
  const db = admin.firestore();
  const campaignDoc = await db.collection("emailCampaigns").doc(campaignId).get();
  if (!campaignDoc.exists) {
    throw new HttpsError("not-found", "Email campaign not found.");
  }
  const campaign = campaignDoc.data();

  const templateDoc = await db.collection("emailTemplates").doc(campaign.templateId).get();
  if (!templateDoc.exists) {
    throw new HttpsError("not-found", "Email template not found.");
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
      const qrCodeImgUrl = p.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({ participantId: participantId, secureToken: p.uniqueToken || `ICADHI-2026-LOCAL-${participantId}` }))}`;
      htmlContent = htmlContent.replace(/\{\{qrCode\}\}/g, `<img src="${qrCodeImgUrl}" width="150" alt="Registration QR Code" style="display:block; margin: 15px auto;" />`);
      htmlContent = htmlContent.replace(/\{\{eventName\}\}/g, "ICADHI 2026");

      await transporter.sendMail({
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to: p.email,
        subject: template.subject || "Your ICADHI 2026 Registration QR Code",
        html: htmlContent
      });

      // Update participant record
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

  // Log action
  await logAudit(
    uid,
    request.auth.token.email,
    role,
    "Emails Sent",
    `Processed batch for campaign ${campaignId} (${successCount} succeeded, ${failureCount} failed)`,
    request.rawRequest?.ip || ""
  );

  return { success: true, successCount, failureCount };
});

/**
 * 5. Callable: Add Admin Audit Log (Accessible by authenticated users)
 */
exports.addAuditLog = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { action, details } = request.data;
  if (!action || !details) {
    throw new HttpsError("invalid-argument", "Missing action or details parameters.");
  }

  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  const userRole = userDoc.exists ? userDoc.data().role : "volunteer";

  await logAudit(
    uid,
    request.auth.token.email,
    userRole,
    action,
    details,
    request.rawRequest?.ip || ""
  );

  return { success: true };
});
