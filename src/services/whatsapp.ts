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
    browser: ['WA-Auto-Bot', 'Safari', '3.0'],
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
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
