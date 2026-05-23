import { settingsDb, getIsFirestoreUsable, handleFirestoreError } from '../database/firebase.js';

const cache: { [key: string]: boolean } = {
  auto_read: false,
  auto_status_view: true,
  auto_status_like: false,
  ai_smart_reply: false,
  anticall: false,
  auto_bio: false,
  fake_typing: false,
  fake_recording: false,
  see_deleted_messages: true,
  save_view_once: true,
};

export const isEnabled = async (feature: string): Promise<boolean> => {
  if (cache[feature] !== undefined) return cache[feature];
  
  if (!getIsFirestoreUsable() || !settingsDb) {
    return false;
  }

  try {
    const doc = await settingsDb.doc(feature).get();
    if (doc.exists) {
      cache[feature] = doc.data()?.value ?? false;
      return cache[feature];
    }
  } catch (err: any) {
    console.warn(`[Settings] Failed to fetch feature ${feature} from Firestore:`, err.message);
    handleFirestoreError(err);
  }
  
  return false;
};

export const setFeature = async (feature: string, value: boolean) => {
  cache[feature] = value;
  if (getIsFirestoreUsable() && settingsDb) {
    try {
      await settingsDb.doc(feature).set({ value });
    } catch (err: any) {
      console.warn(`[Settings] Failed to update feature ${feature} in Firestore:`, err.message);
      handleFirestoreError(err);
    }
  }
};
