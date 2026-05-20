import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

export let isFirestoreUsable = false;

let firestoreDatabaseId: string | undefined;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firestoreDatabaseId = configData.firestoreDatabaseId;
    console.log('Discovered Firestore Database ID:', firestoreDatabaseId);
  }
} catch (e) {
  console.warn('Failed to read firebase-applet-config.json for firestoreDatabaseId:', e);
}

if (!admin.apps.length) {
  try {
    if (config.firebase.projectId && config.firebase.privateKey && config.firebase.clientEmail) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          privateKey: config.firebase.privateKey,
          clientEmail: config.firebase.clientEmail,
        }),
      });
      console.log('Firebase Admin initialized with provided credentials');
    } else {
      // In AI Studio, this will use the internal project credentials automatically
      admin.initializeApp();
      console.log('Firebase Admin initialized with environment credentials');
    }
  } catch (error) {
    console.warn('Firebase initialization failed. Falling back to local storage patterns.', error);
  }
}

export const db = admin.apps.length
  ? (firestoreDatabaseId 
      ? getFirestore(admin.apps[0], firestoreDatabaseId) 
      : getFirestore(admin.apps[0]))
  : null;

export const firestoreReadyPromise = (async () => {
  if (!db) return false;
  try {
    await db.listCollections();
    isFirestoreUsable = true;
    console.log('Firestore is ready and accessible with database ID:', firestoreDatabaseId || '(default)');
    return true;
  } catch (err: any) {
    console.warn('Firestore is initialized but API might be disabled or unreachable:', err.message);
    isFirestoreUsable = false;
    return false;
  }
})();

export const analyticsDb = db ? db.collection('analytics') : null;
export const usersDb = db ? db.collection('users') : null;
export const settingsDb = db ? db.collection('settings') : null;
export const sessionsDb = db ? db.collection('sessions') : null;
export const contactsDb = db ? db.collection('contacts') : null;
export const premiumDb = db ? db.collection('premium') : null;
