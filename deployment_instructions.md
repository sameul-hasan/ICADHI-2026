# ICADHI 2026 Event Registration & QR Check-in System - Deployment Guide

This guide details the environment configuration, initialization steps, and deployment procedures for both the React.js client and the Firebase Cloud Functions.

---

## 1. Environment Variables Setup

Create a `.env` file in the root of the React project (`i:/IEEE/.env`) to configure the Firebase Client SDK:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=icadhi-2026.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=icadhi-2026
VITE_FIREBASE_STORAGE_BUCKET=icadhi-2026.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Make sure to replace these placeholder values with the credentials found under **Project Settings > General > Your apps > Web apps** in the Firebase Console.

---

## 2. Firebase Initializations & Secrets Setup

Firebase Cloud Functions require a cryptographic secret key (`ENCRYPTION_KEY`) to encrypt and decrypt the custom SMTP passwords saved in the database.

### Setting up Functions Environment Config / Secrets
You can set this secret in Firebase Google Cloud Secret Manager using the Firebase CLI:

```bash
# 1. Login to Firebase CLI
firebase login

# 2. Select/Create the Firebase project
firebase use --add icadhi-2026

# 3. Configure the encryption key secret (minimum 32-character string recommended)
firebase functions:secrets:set ENCRYPTION_KEY="your-custom-secure-32char-secret-key-here"
```

If you are running the functions locally using the Firebase emulator suite, you can create a `.env` file inside the `functions/` directory:

```env
ENCRYPTION_KEY="your-custom-secure-32char-secret-key-here"
```

---

## 3. Database Indexes

Before running queries that sort by timestamp and filter by fields, ensure you have the required indexes built. They are defined in the included `firestore.indexes.json`. To deploy them:

```bash
firebase deploy --only firestore:indexes
```

---

## 4. Deploying Security Rules

We have preconfigured robust security rules for Firestore database claims and Cloud Storage asset accesses:

To deploy Firestore security rules:
```bash
firebase deploy --only firestore:rules
```

To deploy Cloud Storage rules:
```bash
firebase deploy --only storage
```

---

## 5. Deploying Cloud Functions

To compile and deploy the backend triggers and callable SMTP functions to Google Cloud infrastructure:

```bash
firebase deploy --only functions
```

---

## 6. Building and Hosting the React Client

Deploy the compiled HTML5/JS single-page application to Firebase Hosting:

```bash
# Build React client assets
npm run build

# Deploy assets to Firebase Hosting
firebase deploy --only hosting
```

---

## 7. Initial Portal Setup (Auto-Bootstrap)

Once deployed, visit your hosting URL:
1. Click **Create Account** on the Auth page.
2. Sign up with a new email.
3. The system checks if the Firestore `users` collection is empty. Since it is a fresh database, **your account will automatically be granted the `super_admin` role**.
4. Log in and navigate to the **SMTP Config** page.
5. Save your mail server details (Host, Port, Username, Password). Use the **Test Connection** button to verify connectivity.
6. Navigate to the **Templates Builder** page and click **Seed ICADHI Template** to load a beautiful pre-styled conference QR invite template.
7. Go to **Excel Upload** to drag & drop your participant list and run verification checks.
8. Commit the import. The Firestore trigger will automatically generate QR codes and upload them to Storage.
9. Go to **Email Campaigns** to broadcast QR codes in batches of 100 to all or selected attendees.
