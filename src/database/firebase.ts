import { config } from '../config/index.js';

export let isFirestoreUsable = false;

export const getIsFirestoreUsable = () => false;

export const setFirestoreUsable = (_usable: boolean) => {};

export const handleFirestoreError = (_err: any) => {};

export let db = null;

export const checkFirestoreReady = async () => false;

export const analyticsDb = null;
export const usersDb = null;
export const settingsDb = null;
export const sessionsDb = null;
export const contactsDb = null;
export const premiumDb = null;
export const terminalsDb = null;
export const paymentsDb = null;
export const agentsDb = null;
export const commandLogsDb = null;

