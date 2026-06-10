import * as admin from 'firebase-admin';

console.log("Keys on * as admin:", Object.keys(admin || {}));
console.log("admin.firestore:", typeof admin.firestore);
console.log("admin.auth:", typeof admin.auth);
console.log("admin.apps:", admin.apps ? admin.apps.length : "undefined");
