import { settingsDb, getIsFirestoreUsable, handleFirestoreError } from '../database/firebase.js';
import fs from 'fs';
import path from 'path';

export const DEFAULTS: { [key: string]: boolean } = {
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
  antilink: false,
  public_mode: true,
};

const SETTINGS_FILE = path.join(process.cwd(), 'settings_cache.json');
const cache: { [key: string]: boolean } = {};

// Load persistent disk cache on startup
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    Object.assign(cache, parsed);
  }
} catch (e) {}

const persistSettingsToDisk = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {}
};

export const isEnabled = async (feature: string, sessionId: string = 'default_bot'): Promise<boolean> => {
  const cacheKey = `${sessionId}_${feature}`;
  if (cache[cacheKey] !== undefined) return cache[cacheKey];
  
  // Default for groups is FALSE (inactive by default - must be explicitly activated)
  const defaultVal = (feature.startsWith('danscom_group_enabled_') || feature.startsWith('group_activated_')) 
    ? false 
    : (DEFAULTS[feature] ?? false);

  if (!getIsFirestoreUsable() || !settingsDb) {
    cache[cacheKey] = defaultVal;
    return defaultVal;
  }

  try {
    const doc = await settingsDb.doc(cacheKey).get();
    if (doc.exists) {
      const storedVal = doc.data()?.value;
      cache[cacheKey] = storedVal !== undefined ? storedVal : defaultVal;
      persistSettingsToDisk();
      return cache[cacheKey];
    }
  } catch (err: any) {
    console.warn(`[Settings] Failed to fetch feature ${feature} for session ${sessionId} from Firestore:`, err.message);
    handleFirestoreError(err);
  }
  
  cache[cacheKey] = defaultVal;
  return cache[cacheKey];
};

export const isGroupActivated = async (groupId: string, sessionId: string = 'default_bot'): Promise<boolean> => {
  // Check both group_activated_ and danscom_group_enabled_ keys
  const activeKey = `group_activated_${groupId}`;
  const legacyKey = `danscom_group_enabled_${groupId}`;
  const isAct = await isEnabled(activeKey, sessionId);
  if (isAct) return true;
  return await isEnabled(legacyKey, sessionId);
};

export const setGroupActivated = async (groupId: string, activated: boolean, sessionId: string = 'default_bot'): Promise<void> => {
  await setFeature(`group_activated_${groupId}`, activated, sessionId);
  await setFeature(`danscom_group_enabled_${groupId}`, activated, sessionId);
};

export const setFeature = async (feature: string, value: boolean, sessionId: string = 'default_bot') => {
  const cacheKey = `${sessionId}_${feature}`;
  cache[cacheKey] = value;
  persistSettingsToDisk();
  
  if (getIsFirestoreUsable() && settingsDb) {
    try {
      await settingsDb.doc(cacheKey).set({ value });
    } catch (err: any) {
      console.warn(`[Settings] Failed to update feature ${feature} for session ${sessionId} in Firestore:`, err.message);
      handleFirestoreError(err);
    }
  }
};

export const getAllFeatures = async (sessionId: string = 'default_bot'): Promise<Record<string, boolean>> => {
  const result: Record<string, boolean> = {};
  for (const feat of Object.keys(DEFAULTS)) {
    result[feat] = await isEnabled(feat, sessionId);
  }
  return result;
};

export const resetFeatures = async (sessionId: string = 'default_bot') => {
  for (const [feat, defaultVal] of Object.entries(DEFAULTS)) {
    await setFeature(feat, defaultVal, sessionId);
  }
};
