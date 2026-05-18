import { 
  AuthenticationCreds, 
  AuthenticationState, 
  SignalDataTypeMap, 
  initAuthCreds, 
  BufferJSON, 
  proto 
} from '@whiskeysockets/baileys';
import { sessionsDb } from './firebase.js';

export const useFirestoreAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
  if (!sessionsDb) {
    throw new Error('Firestore database is not available for auth state storage.');
  }

  const writeData = async (data: any, id: string) => {
    if (!sessionsDb) return;
    await sessionsDb.doc(`${sessionId}_${id}`).set({
      data: JSON.stringify(data, BufferJSON.replacer)
    });
  };

  const readData = async (id: string) => {
    const doc = await sessionsDb.doc(`${sessionId}_${id}`).get();
    if (doc.exists) {
      return JSON.parse(doc.data()?.data, BufferJSON.reviver);
    }
    return null;
  };

  const removeData = async (id: string) => {
    await sessionsDb.doc(`${sessionId}_${id}`).delete();
  };

  const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(value, key));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => {
      await writeData(creds, 'creds');
    }
  };
};
