import admin from 'firebase-admin';
import { config } from '../config/index.js';

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

export const db = admin.apps.length ? admin.firestore() : null;
export const analyticsDb = db ? db.collection('analytics') : null;
export const usersDb = db ? db.collection('users') : null;
export const settingsDb = db ? db.collection('settings') : null;
export const sessionsDb = db ? db.collection('sessions') : null;
export const contactsDb = db ? db.collection('contacts') : null;
export const premiumDb = db ? db.collection('premium') : null;
