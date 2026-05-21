import { settingsDb, getIsFirestoreUsable } from '../database/firebase.js';

const cache: { [key: string]: boolean } = {
  auto_status_view: true,
  ai_smart_reply: false,
};

export const isEnabled = async (feature: string): Promise<boolean> => {
  if (cache[feature] !== undefined) return cache[feature];
  
  if (!getIsFirestoreUsable() || !settingsDb) {
    // Default system features if DB is down or unreachable
    return ['auto_status_view', 'ai_smart_reply', 'auto_save_contacts', 'see_deleted_messages', 'save_view_once'].includes(feature);
  }

  try {
    const doc = await settingsDb.doc(feature).get();
    if (doc.exists) {
      cache[feature] = doc.data()?.value ?? true;
      return cache[feature];
    }
  } catch (err: any) {
    console.warn(`[Settings] Failed to fetch feature ${feature} from Firestore:`, err.message);
  }
  
  return false;
};

export const setFeature = async (feature: string, value: boolean) => {
  if (getIsFirestoreUsable() && settingsDb) {
    try {
      await settingsDb.doc(feature).set({ value });
    } catch (err: any) {
      console.warn(`[Settings] Failed to update feature ${feature} in Firestore:`, err.message);
    }
  }
  cache[feature] = value;
};
