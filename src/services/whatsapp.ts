import makeWASocketImport, { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  WASocket,
  useMultiFileAuthState,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode-terminal';
import { handleMessages } from '../handlers/messageHandler.js';
import { startAutoBio } from './autobio.js';
import { isEnabled } from '../utils/settings.js';
import { config } from '../config/index.js';
import { getTerminalForSession, initiateIntasendPayment } from './terminalService.js';

// Resolve makeWASocket function dynamically
const getMakeWASocket = (): any => {
    if (typeof makeWASocketImport === 'function') {
        return makeWASocketImport;
    }
    if (makeWASocketImport && typeof (makeWASocketImport as any).default === 'function') {
        return (makeWASocketImport as any).default;
    }
    try {
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
    pairingCreatedAt?: number;
    isInitializing: boolean;
    user: { id: string; name: string } | null;
    connectionState?: 'open' | 'connecting' | 'close' | null;
    qrTimedOut?: boolean;
}

const sessions = new Map<string, SessionInfo>();
const pairingLocks = new Map<string, boolean>();
let sock: WASocket | null = null;

export const getExistingSessions = async (): Promise<string[]> => {
    const sessionIds = new Set<string>();
    sessionIds.add('default_bot');
    
    try {
        const fs = await import('fs');
        const path = await import('path');
        if (fs.existsSync('.')) {
            const files = fs.readdirSync('.');
            files.forEach(f => {
                if (f.startsWith('auth_info_baileys_')) {
                    const sessId = f.replace('auth_info_baileys_', '');
                    if (sessId) sessionIds.add(sessId);
                }
            });
        }
        const fallbackPath = path.join(process.cwd(), 'local_auth_fallback');
        if (fs.existsSync(fallbackPath)) {
            const folders = fs.readdirSync(fallbackPath);
            folders.forEach(f => {
                if (f) {
                    const credsFile = path.join(fallbackPath, f, 'creds.json');
                    if (fs.existsSync(credsFile)) {
                        sessionIds.add(f);
                    }
                }
            });
        }
    } catch (e: any) {
        console.warn('Failed to retrieve session directories:', e.message);
    }
    
    return Array.from(sessionIds);
};

export const getConnectionState = () => {
    const def = sessions.get('default_bot');
    if (def) {
        return {
            qr: def.qr,
            pairingCode: def.pairingCode,
            connected: def.connectionState === 'open' && !!def.sock?.user,
            state: def.connectionState || 'disconnected',
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
        state: 'disconnected',
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
            connected: sess.connectionState === 'open' && !!sess.sock?.user,
            pairingNumber: sess.pairingNumber,
            user: sess.sock?.user ? {
                id: sess.sock.user.id,
                name: sess.sock.user.name || 'DANSCOM Bot'
            } : null,
            state: sess.connectionState || 'disconnected'
        });
    });
    return list;
};

export const deleteWhatsAppSession = async (sessionId: string, forceDelete: boolean = false) => {
    console.log(`>> Terminating WhatsApp session: [${sessionId}] (forceDelete: ${forceDelete})`);
    const sess = sessions.get(sessionId);
    if (sess) {
        sess.isInitializing = false;
        if (sess.sock) {
            try {
                sess.sock.end(new Error('Session deleted'));
            } catch (e) {}
            sess.sock = null;
        }
        sessions.delete(sessionId);
    }
    if (sessionId === 'default_bot') {
        sock = null;
    }

    if (forceDelete) {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const dirs = [
                `auth_info_baileys_${sessionId}`,
                path.join(process.cwd(), 'local_auth_fallback', sessionId)
            ];
            for (const dir of dirs) {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                    console.log(`>> Deleted local session folder due to logout/forced delete: ${dir}`);
                }
            }
        } catch (e: any) {
            console.error(`Failed to clean session folder ${sessionId}:`, e.message);
        }
    }
};

export const startWhatsAppSession = async (sessionId: string) => {
    let sess = sessions.get(sessionId);
    if (sess && sess.sock && (sess.connectionState === 'open' || sess.connectionState === 'connecting' || sess.isInitializing)) {
        console.log(`>> Socket [${sessionId}] is already active or connecting. Reusing existing socket.`);
        return sess.sock;
    }

    if (!sess) {
        sess = {
            sessionId,
            sock: null,
            qr: null,
            pairingCode: null,
            pairingNumber: null,
            isInitializing: false,
            user: null,
            connectionState: 'connecting',
            qrTimedOut: false
        };
        sessions.set(sessionId, sess);
    } else {
        sess.qrTimedOut = false;
    }
    
    sess.connectionState = 'connecting';

    if (sess.isInitializing) {
        console.log(`>> Socket [${sessionId}] already initializing, skipping...`);
        return sess.sock;
    }
    sess.isInitializing = true;

    try {
        console.log(`>> Initializing WhatsApp Bot Session: [${sessionId}]...`);
        
        let version: [number, number, number] = [2, 3000, 1015942434];
        try {
            const fetchPromise = fetchLatestBaileysVersion().catch(() => null);
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
            const latest = await Promise.race([fetchPromise, timeoutPromise]);
            if (latest && latest.version) {
                version = latest.version;
            }
        } catch (e) {}

        const authState = await useMultiFileAuthState(`auth_info_baileys_${sessionId}`);
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
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
        });

        sess.sock = currentSock;
        (currentSock as any).sessionId = sessionId;
        
        if (sessionId === 'default_bot') {
            sock = currentSock;
        }

        currentSock.ev.on('creds.update', saveCreds);

        currentSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log(`>> [${sessionId}] Connection update:`, JSON.stringify(update));
            
            if (connection) {
                sess!.connectionState = connection;
            }
            
            if (qr) {
                sess!.qr = qr;
                console.log(`>> [${sessionId}] QR Code generated.`);
                QRCode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                console.log(`>> [${sessionId}] Connection closed.`);
                sess!.qr = null;
                sess!.pairingCode = null;
                sess!.sock = null;
                sess!.isInitializing = false;
                if (sessionId === 'default_bot') {
                    sock = null;
                }
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const errMessage = (lastDisconnect?.error as any)?.message || '';
                const isQrTimeout = statusCode === 408 || errMessage.includes('QR refs attempts ended');
                const isConflict = statusCode === 440 || errMessage.includes('conflict');
                let shouldReconnect = statusCode !== DisconnectReason.loggedOut && !isQrTimeout;
                
                if (isQrTimeout) {
                    console.log(`>> [${sessionId}] QR timeout (408). Resetting session state without deleting auth files...`);
                    await deleteWhatsAppSession(sessionId, false).catch(() => {});
                    sess!.qrTimedOut = true;
                    shouldReconnect = false;
                } else if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`>> Session [${sessionId}] logged out. Wiping session files...`);
                    await deleteWhatsAppSession(sessionId, true).catch(() => {});
                    shouldReconnect = false;
                }

                if (shouldReconnect) {
                    const delay = isConflict ? 10000 : 5000;
                    console.log(`>> [${sessionId}] Reconnecting in ${delay}ms...`);
                    setTimeout(() => startWhatsAppSession(sessionId), delay);
                }
            } else if (connection === 'open') {
                sess!.qr = null;
                sess!.pairingCode = null;
                console.log(`>> WhatsApp connected successfully! [Session: ${sessionId}]`);
                startAutoBio(currentSock);

                if (currentSock.user?.id) {
                    const userJid = currentSock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const userPhone = currentSock.user.id.split(':')[0];
                    try {
                        const { getSessionMetadata, saveSessionMetadata } = await import('./terminalService.js');
                        let mMeta = await getSessionMetadata(sessionId);
                        if (!mMeta) {
                            const clientName = currentSock.user.name || 'DANSCOM Bot';
                            const code = Math.floor(100000 + Math.random() * 900000).toString();
                            mMeta = await saveSessionMetadata(sessionId, clientName, userPhone, false, code);
                        }

                        let welcomeText = `🎉 *Connected Successfully!*\n\nYour *DANSCOM WhatsApp Bot* (Session: \`${sessionId}\`) is now active and online!\n\n🤖 *Bot:* ${currentSock.user.name || 'DANSCOM Bot'}\n📱 *Number:* ${userPhone}\n\nType *.menu* or */menu* to explore commands.`;
                        await currentSock.sendMessage(userJid, { text: welcomeText });
                    } catch (e: any) {
                        console.error('>> Failed to send welcome message:', e.message);
                    }
                }
            }
        });

        currentSock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify' || m.type === 'append') {
                for (const msg of m.messages) {
                    if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                        try {
                            const participant = msg.key.participant || msg.participant;
                            await currentSock.sendMessage('status@broadcast', {
                                react: { text: '💚', key: msg.key }
                            }, { statusJidList: [participant] });
                        } catch (e) {}
                    }
                }
                if (m.type === 'notify') {
                    await handleMessages(currentSock, m);
                }
            }
        });

        currentSock.ev.on('call', async (calls) => {
            if (await isEnabled('anticall', sessionId)) {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        await currentSock.rejectCall(call.id, call.from);
                        await currentSock.sendMessage(call.from, { 
                            text: '⚠️ *Automatic Call Rejection*\nI cannot receive voice or video calls in bot mode.' 
                        });
                    }
                }
            }
        });

    } catch (err: any) {
        console.error(`>> WhatsApp session startup failed [${sessionId}]:`, err.message);
    } finally {
        sess.isInitializing = false;
    }

    return sess.sock;
};

export const requestPairingCode = async (number: string, sessionId: string = 'default_bot') => {
    if (pairingLocks.get(sessionId)) {
        throw new Error('Pairing request already in progress for this session. Please wait.');
    }
    pairingLocks.set(sessionId, true);

    try {
        let sess = sessions.get(sessionId);
        const isConnected = sess && sess.connectionState === 'open' && !!sess.sock?.user;
        
        if (isConnected) {
            throw new Error('Already connected');
        }

        // Ensure session socket is initialized without destroying existing credentials
        if (!sess || !sess.sock) {
            console.log(`[Pairing ${sessionId}] Starting session for pairing code generation...`);
            await startWhatsAppSession(sessionId);
            sess = sessions.get(sessionId);
        }

        let retry = 0;
        while ((!sess || !sess.sock) && retry < 15) {
            await new Promise(resolve => setTimeout(resolve, 400));
            sess = sessions.get(sessionId);
            retry++;
        }

        if (!sess || !sess.sock) throw new Error('WhatsApp socket failed to initialize');
        if (sess.sock.user) throw new Error('Already connected');
        
        console.log(`[Pairing ${sessionId}] Waiting 2s for socket connection handshake...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const cleanNumber = number.replace(/[^0-9]/g, '');
        sess.pairingNumber = cleanNumber;
        console.log(`[Pairing ${sessionId}] Requesting pairing code for clean number: ${cleanNumber}`);
        
        let code: string | undefined = undefined;
        let attempts = 0;
        const maxAttempts = 4;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                console.log(`[Pairing ${sessionId}] Attempt ${attempts} requesting pairing code...`);
                code = await sess.sock.requestPairingCode(cleanNumber);
                if (code) break;
            } catch (err: any) {
                console.warn(`[Pairing ${sessionId}] Attempt ${attempts} failed: ${err.message}`);
                if (attempts >= maxAttempts) {
                    throw new Error(err.message || 'Failed to request pairing code. Unable to connect to WhatsApp servers.');
                }
                const backoffMs = Math.min(2000 * Math.pow(2, attempts - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }

        sess.pairingCode = code || null;
        sess.pairingCreatedAt = Date.now();
        console.log(`[Pairing ${sessionId}] Pairing code generated successfully: ${code}`);

        return code;
    } finally {
        pairingLocks.set(sessionId, false);
    }
};

export const startWhatsApp = async () => {
    const list = await getExistingSessions();
    console.log('>> Loading existing WhatsApp sessions:', list);
    for (const sessId of list) {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const creds1 = `auth_info_baileys_${sessId}/creds.json`;
            const creds2 = path.join(process.cwd(), 'local_auth_fallback', sessId, 'creds.json');
            if (fs.existsSync(creds1) || fs.existsSync(creds2)) {
                await startWhatsAppSession(sessId);
            }
        } catch (e: any) {
            console.error(`Failed to start session ${sessId}:`, e.message);
        }
    }

    if (!sessions.has('default_bot')) {
        const fs = await import('fs');
        const path = await import('path');
        const creds1 = `auth_info_baileys_default_bot/creds.json`;
        const creds2 = path.join(process.cwd(), 'local_auth_fallback', 'default_bot', 'creds.json');
        if (fs.existsSync(creds1) || fs.existsSync(creds2)) {
            await startWhatsAppSession('default_bot');
        }
    }

    startConnectionMonitor();
    return sessions.get('default_bot')?.sock || null;
};

let connectionMonitorInterval: any = null;
const startConnectionMonitor = () => {
    if (connectionMonitorInterval) return;
    connectionMonitorInterval = setInterval(async () => {
        try {
            // Robust check: ensure NO session is currently in pairing process (pairingCode non-null), initializing, or connecting
            for (const [sessId, sess] of sessions.entries()) {
                if (sess && (sess.pairingCode !== null && sess.pairingCode !== undefined || sess.isInitializing || sess.connectionState === 'connecting')) {
                    console.log(`[Connection Monitor] Session [${sessId}] is in active pairing, initialization, or connecting state. Skipping monitor revival.`);
                    return;
                }
            }

            let def = sessions.get('default_bot');
            if (!def && !sessions.has('default_bot')) {
                const fs = await import('fs');
                if (fs.existsSync('auth_info_baileys_default_bot/creds.json')) {
                    await startWhatsAppSession('default_bot').catch(() => {});
                }
            } else if (def && !def.sock && !def.isInitializing && !def.pairingCode && def.connectionState !== 'connecting' && !def.qrTimedOut) {
                await startWhatsAppSession('default_bot').catch(() => {});
            }
        } catch (e) {}
    }, 60000);
};

export const restartWhatsAppSession = async (sessionId: string) => {
    await deleteWhatsAppSession(sessionId);
    return await startWhatsAppSession(sessionId);
};

export const restartWhatsApp = async () => {
    return await startWhatsApp();
};

export { sock };
