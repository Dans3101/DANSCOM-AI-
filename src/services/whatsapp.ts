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

export const getConnectionState = () => ({
    qr: currentQr,
    pairingCode: currentPairingCode,
    connected: !!sock?.user,
    pairingNumber: currentPairingNumber
});

export const requestPairingCode = async (number: string) => {
    if (!sock) throw new Error('WhatsApp socket not initialized');
    if (sock.user) throw new Error('Already connected');
    
    currentPairingNumber = number.replace(/[^0-9]/g, '');
    console.log(`Requesting pairing code for: ${currentPairingNumber}`);
    try {
        const code = await sock.requestPairingCode(currentPairingNumber);
        currentPairingCode = code || null;
        console.log(`Pairing code received: ${code}`);
        return code;
    } catch (error) {
        console.error('Failed to request pairing code:', error);
        throw error;
    }
};

export const startWhatsApp = async () => {
    // If already initialized, don't start again unless we need to
    if (sock && !sock.user) {
        console.log('Bot already initializing...');
    }

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

  let authState;
  
  try {
    if (sessionsDb) {
        console.log('Using Firestore for session storage...');
        authState = await useFirestoreAuthState('default_bot');
    } else {
        console.log('Fallback: Using local file system for session storage...');
        authState = await useMultiFileAuthState('auth_info_baileys');
    }
  } catch (error) {
    console.error('Auth state initialization failed:', error);
    authState = await useMultiFileAuthState('auth_info_baileys');
  }

  const { state, saveCreds } = authState;

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['DANSCOM', 'Chrome', '110.0.0'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      currentQr = qr;
      console.log('>> QR Code generated');
      QRCode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      currentQr = null;
      currentPairingCode = null;
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`Connection closed (Reason: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 5000);
      }
    } else if (connection === 'open') {
      currentQr = null;
      currentPairingCode = null;
      console.log('WhatsApp connection opened successfully!');
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
