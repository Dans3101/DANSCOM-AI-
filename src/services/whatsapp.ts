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
    const code = await sock.requestPairingCode(currentPairingNumber);
    currentPairingCode = code || null;
    return code;
};

let currentPairingNumber: string | null = null;
export const startWhatsApp = async () => {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

  let authState;
  
  if (sessionsDb) {
    console.log('Using Firestore for session storage...');
    authState = await useFirestoreAuthState('default_bot');
  } else {
    console.log('Fallback: Using local file system for session storage...');
    authState = await useMultiFileAuthState('auth_info_baileys');
  }

  const { state, saveCreds } = authState;

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['DANSCOM', 'Safari', '3.0'],
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on('creds.update', saveCreds);

  const pairingNumber = config.bot.ownerNumber;
  const usePairingCode = true; // We will trigger this if requested

  if (usePairingCode && !state.creds.registered) {
    if (pairingNumber) {
        setTimeout(async () => {
            try {
                const code = await sock?.requestPairingCode(pairingNumber);
                currentPairingCode = code || null;
                console.log(`\n\n========================================`);
                console.log(`PAIRING CODE: ${code}`);
                console.log(`========================================\n\n`);
            } catch (err) {
                console.error('Pairing Code Error:', err);
            }
        }, 3000);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      currentQr = qr;
      console.log('QR Code generated. Scan with your WhatsApp:');
      QRCode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        startWhatsApp();
      }
    } else if (connection === 'open') {
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
