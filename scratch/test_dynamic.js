async function test() {
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');

    console.log("initializeApp:", typeof initializeApp);
    console.log("getApps:", typeof getApps);
    console.log("cert:", typeof cert);
    console.log("getFirestore:", typeof getFirestore);
    console.log("FieldValue:", typeof FieldValue);
    console.log("getAuth:", typeof getAuth);
  } catch (err) {
    console.error("Dynamic import failed:", err);
  }
}

test();
