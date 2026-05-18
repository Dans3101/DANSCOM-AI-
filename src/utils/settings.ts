import { settingsDb } from '../database/firebase.js';

const cache: { [key: string]: boolean } = {};

export const isEnabled = async (feature: string): Promise<boolean> => {
  if (cache[feature] !== undefined) return cache[feature];
  
  if (!settingsDb) {
    // Default system features if DB is down
    return ['auto_status_view', 'ai_smart_reply'].includes(feature);
  }

  const doc = await settingsDb.doc(feature).get();
  if (doc.exists) {
    cache[feature] = doc.data()?.value ?? true;
    return cache[feature];
  }
  
  return false;
};

export const setFeature = async (feature: string, value: boolean) => {
  if (settingsDb) {
    await settingsDb.doc(feature).set({ value });
  }
  cache[feature] = value;
};
