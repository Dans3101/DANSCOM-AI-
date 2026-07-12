import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

export let isFirestoreUsable = false;
let firestoreDisabledUntil = 0;

export const getIsFirestoreUsable = () => {
  if (!isFirestoreUsable && firestoreDisabledUntil < Date.now()) {
    isFirestoreUsable = true;
    firestoreDisabledUntil = 0;
  }
  return isFirestoreUsable;
};

export const setFirestoreUsable = (usable: boolean) => {
  isFirestoreUsable = usable;
};

export const handleFirestoreError = (err: any) => {
  if (!err) return;
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('quota') || 
    msg.includes('exhausted') || 
    msg.includes('resource_exhausted') || 
    msg.includes('limit') || 
    msg.includes('reached') || 
    msg.includes('failed to get document') || 
    msg.includes('connection timed out') ||
    msg.includes('timeout') ||
    msg.includes('deadline_exceeded') || 
    msg.includes('unavailable') ||
    msg.includes('resource exhausted')
  ) {
    if (isFirestoreUsable) {
        console.warn(`[Firebase] Firestore Resource Issue detected (Quota/Timeout). Disabling Firestore for 1 hour. Error:`, err.message);
        isFirestoreUsable = false;
        firestoreDisabledUntil = Date.now() + 3600000; // 1 hour
    }
  }
};

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

console.log('Firebase Admin apps length:', admin.apps.length);
if (!admin.apps.length) {
  try {
    console.log('Firebase config:', !!config.firebase.projectId, !!config.firebase.privateKey, !!config.firebase.clientEmail);
    if (config.firebase.projectId && config.firebase.privateKey && config.firebase.clientEmail) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebase.projectId,
            privateKey: config.firebase.privateKey,
            clientEmail: config.firebase.clientEmail,
          }),
        });
        console.log('Firebase Admin initialized with provided credentials');
      } catch (certError: any) {
        console.warn('Firebase Admin cert initialization failed, trying default credentials:', certError.message);
        admin.initializeApp();
        console.log('Firebase Admin initialized with environment credentials after cert fallback');
      }
    } else {
      // In AI Studio, this will use the internal project credentials automatically
      admin.initializeApp();
      console.log('Firebase Admin initialized with environment credentials');
    }
  } catch (error) {
    console.warn('Firebase initialization failed. Falling back to local storage patterns.', error);
  }
}

let firestoreDb: any = null;
if (admin.apps.length) {
  try {
    firestoreDb = firestoreDatabaseId 
      ? getFirestore(admin.apps[0], firestoreDatabaseId) 
      : getFirestore(admin.apps[0]);
  } catch (err: any) {
    console.warn('[Firebase] Firestore instance initialization failed at module load:', err.message);
  }
}
export const db = firestoreDb;

export const checkFirestoreReady = async () => {
  if (!db) return false;
  try {
    const listCollectionsPromise = db.listCollections()
      .then(() => 'success' as const)
      .catch((err: any) => {
        return err;
      });
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout' as const), 10000)
    );
    const result = await Promise.race([listCollectionsPromise, timeoutPromise]);
    
    if (result === 'timeout') {
      throw new Error('Firestore network check timed out (10s)');
    } else if (result instanceof Error) {
      throw result;
    }
    
    isFirestoreUsable = true;
    console.log('Firestore is ready and accessible with database ID:', firestoreDatabaseId || '(default)');
    return true;
  } catch (err: any) {
    console.warn('[Firebase] Firestore check failed:', err.message);
    isFirestoreUsable = false;
    firestoreDisabledUntil = Date.now() + 3600000; // 1 hour
    return false;
  }
};

export const analyticsDb = db ? db.collection('analytics') : null;
export const usersDb = db ? db.collection('users') : null;
export const settingsDb = db ? db.collection('settings') : null;
export const sessionsDb = db ? db.collection('sessions') : null;
export const contactsDb = db ? db.collection('contacts') : null;
export const premiumDb = db ? db.collection('premium') : null;
export const terminalsDb = db ? db.collection('terminals') : null;
export const paymentsDb = db ? db.collection('payments') : null;
export const agentsDb = db ? db.collection('agents') : null;
export const commandLogsDb = db ? db.collection('commandLogs') : null;
