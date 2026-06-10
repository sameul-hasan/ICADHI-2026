import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

console.log("admin keys:", Object.keys(admin || {}));
console.log("admin.firestore:", typeof admin.firestore);
console.log("admin.auth:", typeof admin.auth);
console.log("admin.apps:", admin.apps ? admin.apps.length : "undefined");
