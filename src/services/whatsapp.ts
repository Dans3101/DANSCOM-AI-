import makeWASocket, { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  WASocket,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode-terminal';
import { useFirestoreAuthState } from '../database/firestoreStore.js';
import { sessionsDb } from '../database/firebase.js';
import { handleMessages } from '../handlers/messageHandler.js';
import { startAutoBio } from './autobio.js';
import { isEnabled } from '../utils/settings.js';
import { config } from '../config/index.js';

let sock: WASocket | null = null;
let currentQr: string | null = null;
let currentPairingCode: string | null = null;
let currentPairingNumber: string | null = null;
let isInitializing = false;

export const getConnectionState = () => ({
    qr: currentQr,
    pairingCode: currentPairingCode,
    connected: !!sock?.user,
    pairingNumber: currentPairingNumber,
    user: sock?.user ? {
        id: sock.user.id,
        name: sock.user.name || 'DANSCOM Bot'
    } : null
});

export const requestPairingCode = async (number: string) => {
    if (!sock) {
        console.log('Socket not found, starting WhatsApp...');
        await startWhatsApp();
    }
    
    // Wait a bit for socket to be ready
    let retry = 0;
    while (!sock && retry < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retry++;
    }

    if (!sock) throw new Error('WhatsApp socket failed to initialize');
    if (sock.user) throw new Error('Already connected');
    
    currentPairingNumber = number.replace(/[^0-9]/g, '');
    console.log(`[Pairing] Requesting code for: ${currentPairingNumber}`);
    
    try {
        const code = await sock.requestPairingCode(currentPairingNumber);
        currentPairingCode = code || null;
        console.log(`[Pairing] Code received: ${code}`);
        return code;
    } catch (error: any) {
        console.error('[Pairing] Error:', error);
        throw new Error(error.message || 'Failed to request pairing code. Try again in 10 seconds.');
    }
};

export const restartWhatsApp = async () => {
    console.log('>> Force restarting WhatsApp connection...');
    isInitializing = false;
    currentQr = null;
    currentPairingCode = null;
    if (sock) {
        try {
            // Remove listeners first to avoid double reconnects
            sock.ev.removeAllListeners('connection.update');
            sock.end(undefined);
        } catch (e) {}
    }
    sock = null;
    return startWhatsApp();
};

export const startWhatsApp = async () => {
    if (isInitializing) {
        console.log('>> Socket already initializing, skipping...');
        return sock;
    }
    isInitializing = true;

  console.log('>> Initializing DANSCOM WhatsApp Bot...');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`>> Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

  let authState;
  
  try {
    if (sessionsDb) {
        console.log('>> Using Firestore for session storage');
        authState = await useFirestoreAuthState('default_bot');
    } else {
        console.log('>> Using local file system for session storage');
        authState = await useMultiFileAuthState('auth_info_baileys');
    }
  } catch (error) {
    console.error('>> Auth state initialization failed:', error);
    authState = await useMultiFileAuthState('auth_info_baileys');
  }

  const { state, saveCreds } = authState;

  // Cleanup old socket if exists
  if (sock) {
    try {
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.ev.removeAllListeners('messages.upsert');
    } catch (e) {}
  }

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    // Using a more standard browser setting for pairing code compatibility
    browser: ['Ubuntu', 'Chrome', '110.0.5563.147'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
  });

  isInitializing = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      currentQr = qr;
      console.log('>> NEW QR Code generated');
      QRCode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      currentQr = null;
      currentPairingCode = null;
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`>> Connection closed (Reason: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('>> Session logged out. Clearing data...');
        if (sessionsDb) {
            try {
                const snapshot = await sessionsDb.where('__name__', '>=', 'default_bot_').get();
                const batch = sessionsDb.firestore.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            } catch (e) {
                console.error('Failed to clear firestore session:', e);
            }
        }
      }

      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 5000);
      }
    } else if (connection === 'open') {
      currentQr = null;
      currentPairingCode = null;
      console.log('>> DANSCOM connected successfully!');
      startAutoBio(sock!);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      await handleMessages(sock!, m);
    }
  });

  sock.ev.on('call', async (calls) => {
    if (await isEnabled('anticall')) {
        for (const call of calls) {
            if (call.status === 'offer') {
                console.log(`Rejecting call from ${call.from}`);
                await sock?.rejectCall(call.id, call.from);
                await sock?.sendMessage(call.from, { 
                    text: '⚠️ *Automatic Call Rejection*\nI am currently in bot mode and cannot receive calls. Please send a message instead.' 
                });
            }
        }
    }
  });

  return sock;
};

export { sock };
