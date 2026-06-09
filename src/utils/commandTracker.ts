import { analyticsDb, getIsFirestoreUsable, handleFirestoreError } from '../database/firebase.js';

let inMemoryTotalCommands = 0;
let initialized = false;

export async function getCommandCount(): Promise<number> {
  if (initialized) {
    return inMemoryTotalCommands;
  }

  // Fallback default
  let total = 6280; // Elegant default/fallback count

  // Analytics query currently disabled to save Firestore quota.
  /*
  if (getIsFirestoreUsable() && analyticsDb) {
    try {
      const analytics = await analyticsDb.get();
      let queryTotal = 0;
      analytics.forEach((doc: any) => {
        queryTotal += (doc.data()?.usageCount || 0);
      });
      if (queryTotal > 0) {
        total = queryTotal;
      }
    } catch (err: any) {
      console.warn('[Command Tracker] Initial Firestore stats query failed, using in-memory fallback:', err.message);
      handleFirestoreError(err);
    }
  }
  */

  inMemoryTotalCommands = total;
  initialized = true;
  return inMemoryTotalCommands;
}

export function incrementCommandCount() {
  inMemoryTotalCommands += 1;
}
