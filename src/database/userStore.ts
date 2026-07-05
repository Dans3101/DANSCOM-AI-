import { usersDb, getIsFirestoreUsable, handleFirestoreError } from './firebase.js';

export interface UserProfile {
  role: 'superadmin' | 'admin' | 'user';
  isBlocked: boolean;
  usageCount: number;
  lastSeen: string;
}

export const getUser = async (userId: string): Promise<UserProfile | null> => {
  if (getIsFirestoreUsable() && usersDb) {
    try {
      const doc = await usersDb.doc(userId).get();
      if (doc.exists) {
        return doc.data() as UserProfile;
      }
    } catch (err: any) {
      console.error('[UserStore] getUser failed:', err.message);
      handleFirestoreError(err);
    }
  }
  return null;
};

export const updateUser = async (userId: string, data: Partial<UserProfile>) => {
  if (getIsFirestoreUsable() && usersDb) {
    try {
      await usersDb.doc(userId).set(data, { merge: true });
    } catch (err: any) {
      console.error('[UserStore] updateUser failed:', err.message);
      handleFirestoreError(err);
    }
  }
};
