import makeWASocketImport, { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  WASocket,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode-terminal';
import { useFirestoreAuthState } from '../database/firestoreStore.js';
import { sessionsDb, firestoreReadyPromise } from '../database/firebase.js';
import { handleMessages } from '../handlers/messageHandler.js';
import { startAutoBio } from './autobio.js';
import { isEnabled } from '../utils/settings.js';
import { config } from '../config/index.js';

// Resolve makeWASocket function dynamically to handle both ESM and Node bundled CJS environments
const getMakeWASocket = (): any => {
    if (typeof makeWASocketImport === 'function') {
        return makeWASocketImport;
    }
    if (makeWASocketImport && typeof (makeWASocketImport as any).default === 'function') {
        return (makeWASocketImport as any).default;
    }
    try {
        // Fallback for strict CommonJS contexts where the library is required directly
        const baileysModule = require('@whiskeysockets/baileys');
        if (typeof baileysModule === 'function') {
            return baileysModule;
        }
        if (baileysModule && typeof baileysModule.default === 'function') {
            return baileysModule.default;
        }
    } catch (e) {}
    return makeWASocketImport;
};

const makeWASocket = getMakeWASocket();

export interface SessionInfo {
    sessionId: string;
    sock: WASocket | null;
    qr: string | null;
    pairingCode: string | null;
    pairingNumber: string | null;
    isInitializing: boolean;
    user: { id: string; name: string } | null;
}

const sessions = new Map<string, SessionInfo>();
let sock: WASocket | null = null;

export const getExistingSessions = async (): Promise<string[]> => {
    const sessionIds = new Set<string>();
    sessionIds.add('default_bot'); // always ensure design compatibility
    
    const isReady = await firestoreReadyPromise;
    if (sessionsDb && isReady) {
        try {
            const snapshot = await sessionsDb.get();
            snapshot.docs.forEach(doc => {
                const id = doc.id;
                if (id.endsWith('_creds')) {
                    const sessId = id.substring(0, id.length - 6);
                    if (sessId && sessId !== 'default_bot') sessionIds.add(sessId);
                }
            });
        } catch (e) {
            console.error('Failed to retrieve firestore sessions:', e);
        }
    } else {
        try {
            const fs = await import('fs');
            if (fs.existsSync('.')) {
                const files = fs.readdirSync('.');
                files.forEach(f => {
                    if (f.startsWith('auth_info_baileys_')) {
                        const sessId = f.replace('auth_info_baileys_', '');
                        if (sessId && sessId !== 'default_bot') sessionIds.add(sessId);
                    }
                });
            }
        } catch (e) {}
    }
    return Array.from(sessionIds);
};

export const getConnectionState = () => {
    const def = sessions.get('default_bot');
    if (def) {
        return {
            qr: def.qr,
            pairingCode: def.pairingCode,
            connected: !!def.sock?.user,
            pairingNumber: def.pairingNumber,
            user: def.sock?.user ? {
                id: def.sock.user.id,
                name: def.sock.user.name || 'DANSCOM Bot'
            } : null
        };
    }
    return {
        qr: null,
        pairingCode: null,
        connected: false,
        pairingNumber: null,
        user: null
    };
};

export const getSessionsState = () => {
    const list: any[] = [];
    sessions.forEach((sess) => {
        list.push({
            sessionId: sess.sessionId,
            qr: sess.qr,
            pairingCode: sess.pairingCode,
            connected: !!sess.sock?.user,
            pairingNumber: sess.pairingNumber,
            user: sess.sock?.user ? {
                id: sess.sock.user.id,
                name: sess.sock.user.name || 'DANSCOM Bot'
            } : null
        });
    });
    return list;
};

export const requestPairingCode = async (number: string, sessionId: string = 'default_bot') => {
    let sess = sessions.get(sessionId);
    if (!sess) {
        await startWhatsAppSession(sessionId);
        sess = sessions.get(sessionId);
    }
    
    let retry = 0;
    while ((!sess || !sess.sock) && retry < 15) {
        await new Promise(resolve => setTimeout(resolve, 500));
        sess = sessions.get(sessionId);
        retry++;
    }

    if (!sess || !sess.sock) throw new Error('WhatsApp socket failed to initialize');
    if (sess.sock.user) throw new Error('Already connected');
    
    sess.pairingNumber = number.replace(/[^0-9]/g, '');
    console.log(`[Pairing ${sessionId}] Requesting code for: ${sess.pairingNumber}`);
    
    try {
        const code = await sess.sock.requestPairingCode(sess.pairingNumber);
        sess.pairingCode = code || null;
        console.log(`[Pairing ${sessionId}] Code received: ${code}`);
        return code;
    } catch (error: any) {
        console.error(`[Pairing ${sessionId}] Error:`, error);
        throw new Error(error.message || 'Failed to request pairing code. Try again in 10 seconds.');
    }
};

export const restartWhatsApp = async () => {
    console.log('>> Force restarting all WhatsApp connections...');
    for (const sessId of sessions.keys()) {
        try {
            await restartWhatsAppSession(sessId);
        } catch (e) {}
    }
};

export const restartWhatsAppSession = async (sessionId: string) => {
    console.log(`>> Force restarting WhatsApp connection for [${sessionId}]...`);
    const sess = sessions.get(sessionId);
    if (sess) {
        sess.isInitializing = false;
        sess.qr = null;
        sess.pairingCode = null;
        if (sess.sock) {
            try {
                sess.sock.ev.removeAllListeners('connection.update');
                sess.sock.end(undefined);
            } catch (e) {}
        }
        sess.sock = null;
    }
    return startWhatsAppSession(sessionId);
};

export const deleteWhatsAppSession = async (sessionId: string) => {
    console.log(`>> Deleting WhatsApp session [${sessionId}]...`);
    const sess = sessions.get(sessionId);
    if (sess) {
        sess.isInitializing = false;
        if (sess.sock) {
            try {
                sess.sock.ev.removeAllListeners('connection.update');
                sess.sock.end(new Error('Session deleted'));
            } catch (e) {}
        }
        sessions.delete(sessionId);
    }
    
    const isReady = await firestoreReadyPromise;
    if (sessionsDb && isReady) {
        try {
            const snapshot = await sessionsDb.get();
            const batch = sessionsDb.firestore.batch();
            let count = 0;
            snapshot.docs.forEach(doc => {
                if (doc.id.startsWith(`${sessionId}_`)) {
                    batch.delete(doc.ref);
                    count++;
                }
            });
            if (count > 0) {
                await batch.commit();
            }
        } catch (e) {
            console.error(`Failed to clear firestore session ${sessionId}:`, e);
        }
    } else {
        try {
            const fs = await import('fs');
            const dir = `auth_info_baileys_${sessionId}`;
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch (e) {}
    }
};

export const startWhatsAppSession = async (sessionId: string) => {
    let sess = sessions.get(sessionId);
    if (!sess) {
        sess = {
            sessionId,
            sock: null,
            qr: null,
            pairingCode: null,
            pairingNumber: null,
            isInitializing: false,
            user: null
        };
        sessions.set(sessionId, sess);
    }

    if (sess.isInitializing) {
        console.log(`>> Socket [${sessionId}] already initializing, skipping...`);
        return sess.sock;
    }
    sess.isInitializing = true;

    try {
        console.log(`>> Initializing DANSCOM WhatsApp Bot [Session: ${sessionId}]...`);
        
        let version: [number, number, number] = [2, 3000, 1015942434];
        try {
            const latest = await fetchLatestBaileysVersion().catch(() => null);
            if (latest?.version) {
                version = latest.version;
                console.log(`>> Using Baileys v${version.join('.')}, isLatest: ${latest.isLatest} [Session: ${sessionId}]`);
            } else {
                console.log(`>> Using fallback Baileys v${version.join('.')} [Session: ${sessionId}]`);
            }
        } catch (err) {
            console.warn('>> Failed to fetch latest Baileys version, using fallback:', err);
        }

        let authState;
        try {
            const isReady = await firestoreReadyPromise;
            if (sessionsDb && isReady) {
                console.log(`>> Using Firestore for session storage [Session: ${sessionId}]`);
                authState = await useFirestoreAuthState(sessionId);
            } else {
                console.log(`>> Using local file system for session storage [Session: ${sessionId}]`);
                authState = await useMultiFileAuthState(`auth_info_baileys_${sessionId}`);
            }
        } catch (error) {
            console.error('>> Auth state initialization failed:', error);
            authState = await useMultiFileAuthState(`auth_info_baileys_${sessionId}`);
        }

        const { state, saveCreds } = authState;

        if (sess.sock) {
            try {
                sess.sock.ev.removeAllListeners('connection.update');
                sess.sock.ev.removeAllListeners('creds.update');
                sess.sock.ev.removeAllListeners('messages.upsert');
            } catch (e) {}
        }

        const currentSock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '110.0.5563.147'],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
        });

        sess.sock = currentSock;
        
        // For backwards compatibility, expose default bot socket on export var
        if (sessionId === 'default_bot') {
            sock = currentSock;
        }

        currentSock.ev.on('creds.update', saveCreds);

        currentSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                sess!.qr = qr;
                console.log(`>> NEW QR Code generated for session: [${sessionId}]`);
                QRCode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                sess!.qr = null;
                sess!.pairingCode = null;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`>> Connection closed for session: [${sessionId}] (Reason: ${statusCode}). Reconnecting: ${shouldReconnect}`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`>> Session [${sessionId}] logged out. Clearing data...`);
                    const isReady = await firestoreReadyPromise;
                    if (sessionsDb && isReady) {
                        try {
                            const snapshot = await sessionsDb.get();
                            const batch = sessionsDb.firestore.batch();
                            let count = 0;
                            snapshot.docs.forEach(doc => {
                                if (doc.id.startsWith(`${sessionId}_`)) {
                                    batch.delete(doc.ref);
                                    count++;
                                }
                            });
                            if (count > 0) {
                                await batch.commit();
                            }
                        } catch (e) {
                            console.error(`Failed to clear firestore session: ${sessionId}`, e);
                        }
                    } else {
                        try {
                            const fs = await import('fs');
                            const dir = `auth_info_baileys_${sessionId}`;
                            if (fs.existsSync(dir)) {
                                fs.rmSync(dir, { recursive: true, force: true });
                            }
                        } catch (e) {}
                    }
                }

                if (shouldReconnect) {
                    setTimeout(() => startWhatsAppSession(sessionId), 5000);
                }
            } else if (connection === 'open') {
                sess!.qr = null;
                sess!.pairingCode = null;
                console.log(`>> DANSCOM connected successfully! [Session: ${sessionId}]`);
                startAutoBio(currentSock);

                // Send congratulations message directly in user's DM
                if (currentSock.user?.id) {
                    const userJid = currentSock.user.id.split(':')[0] + '@s.whatsapp.net';
                    try {
                        const welcomeText = `🎉 *Congratulations!*\n\nYour *DANSCOM WhatsApp Bot* (Session: \`${sessionId}\`) has been successfully connected and is now fully active!\n\n🤖 *Bot Profile:* ${currentSock.user.name || 'DANSCOM Bot'}\n📱 *Number:* ${currentSock.user.id.split(':')[0]}\n\nEnjoy using your automated features! Keep this chat open if you want to test commands directly! Type /menu or .menu.`;
                        await currentSock.sendMessage(userJid, {
                            text: welcomeText
                        });
                        console.log(`>> Congrats welcome message sent to ${userJid}`);
                    } catch (err: any) {
                        console.error('>> Failed to send connection congratulations message:', err.message);
                    }
                }
            }
        });

        currentSock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                await handleMessages(currentSock, m);
            }
        });

        currentSock.ev.on('call', async (calls) => {
            if (await isEnabled('anticall')) {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        console.log(`Rejecting call from ${call.from} [Session: ${sessionId}]`);
                        await currentSock.rejectCall(call.id, call.from);
                        await currentSock.sendMessage(call.from, { 
                            text: '⚠️ *Automatic Call Rejection*\nI am currently in bot mode and cannot receive calls. Please send a message instead.' 
                        });
                    }
                }
            }
        });

    } catch (err: any) {
        console.error(`>> WhatsApp Bot startup failed for [${sessionId}]:`, err.message);
    } finally {
        sess.isInitializing = false;
    }

    return sess.sock;
};

export const startWhatsApp = async () => {
    const list = await getExistingSessions();
    console.log('>> Loading existing WhatsApp sessions from database/storage:', list);
    for (const sessId of list) {
        try {
            await startWhatsAppSession(sessId);
        } catch (e: any) {
            console.error(`Failed to start session ${sessId}:`, e.message);
        }
    }
    // Always guarantee 'default_bot' runs
    if (!sessions.has('default_bot')) {
        await startWhatsAppSession('default_bot');
    }

    // Start background Connection Monitor Keepalive
    startConnectionMonitor();

    return sessions.get('default_bot')?.sock || null;
};

// Defensive Connection Monitor to keep bot active all the time
let connectionMonitorInterval: any = null;
const startConnectionMonitor = () => {
    if (connectionMonitorInterval) return;
    console.log('>> Initiating DANSCOM Connection Monitor kept-alive daemon (30s checks)');
    connectionMonitorInterval = setInterval(async () => {
        try {
            // 1. Maintain default_bot active
            let def = sessions.get('default_bot');
            if (!def) {
                console.log('[Connection Monitor] default_bot session is missing, bringing it online...');
                await startWhatsAppSession('default_bot').catch(() => {});
            } else if (!def.sock?.user && !def.isInitializing) {
                console.log('[Connection Monitor] default_bot is currently offline/disconnected, automatically reviving...');
                await startWhatsAppSession('default_bot').catch(() => {});
            }

            // 2. Maintain other existing authenticated sessions active
            const activeDbSessions = await getExistingSessions();
            for (const sessId of activeDbSessions) {
                if (sessId === 'default_bot') continue;
                let sess = sessions.get(sessId);
                if (!sess) {
                    console.log(`[Connection Monitor] Saved session [${sessId}] was missing from memory. Auto-loading...`);
                    await startWhatsAppSession(sessId).catch(() => {});
                } else if (!sess.sock?.user && !sess.isInitializing) {
                    console.log(`[Connection Monitor] Session [${sessId}] has disconnected/gone offline. Reviving...`);
                    await startWhatsAppSession(sessId).catch(() => {});
                }
            }
        } catch (monitorErr: any) {
            console.error('[Connection Monitor Error]:', monitorErr.message);
        }
    }, 30000);
};

export { sock };
