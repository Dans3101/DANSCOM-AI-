import makeWASocketImport, { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  WASocket,
  useMultiFileAuthState,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { handleMessages } from '../handlers/messageHandler.js';
import { startAutoBio } from './autobio.js';
import { isEnabled } from '../utils/settings.js';
import { config } from '../config/index.js';
import { getTerminalForSession, initiateIntasendPayment } from './terminalService.js';

// Dedicated persistent welcome delivery tracker to completely eliminate duplicate welcome spam
const WELCOME_CACHE_FILE = path.join(process.cwd(), 'welcome_sent_cache.json');
const welcomeSentRecords = new Set<string>();

try {
    if (fs.existsSync(WELCOME_CACHE_FILE)) {
        const raw = fs.readFileSync(WELCOME_CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            parsed.forEach(p => welcomeSentRecords.add(p));
        }
    }
} catch (e) {}

const markWelcomeSent = (identifier: string) => {
    welcomeSentRecords.add(identifier);
    try {
        fs.writeFileSync(WELCOME_CACHE_FILE, JSON.stringify(Array.from(welcomeSentRecords), null, 2));
    } catch (e) {}
};

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

export const isSessionRegisteredOnDisk = async (sessionId: string): Promise<boolean> => {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const paths = [
            path.join(process.cwd(), `auth_info_baileys_${sessionId}`, 'creds.json'),
            path.join(process.cwd(), 'local_auth_fallback', sessionId, 'creds.json')
        ];
        for (const credsPath of paths) {
            if (fs.existsSync(credsPath)) {
                try {
                    const content = fs.readFileSync(credsPath, 'utf-8');
                    const parsed = JSON.parse(content);
                    if (parsed && (parsed.registered === true || (parsed.me && parsed.me.id))) {
                        return true;
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
    return false;
};

export const getExistingSessions = async (): Promise<string[]> => {
    const sessionIds = new Set<string>();
    
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

    sessions.forEach((_, id) => sessionIds.add(id));
    
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
                sess.sock.end(undefined);
            } catch (e) {}
            sess.sock = null;
        }

        const currentSock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
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
            
            if (connection) {
                sess!.connectionState = connection;
                console.log(`>> [${sessionId}] Connection state: ${connection}`);
            }
            
            if (qr) {
                sess!.qr = qr;
                console.log(`>> [${sessionId}] QR Code ready.`);
            }

            if (connection === 'close') {
                sess!.sock = null;
                sess!.isInitializing = false;
                if (sessionId === 'default_bot') {
                    sock = null;
                }
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode || (lastDisconnect?.error as any)?.data?.reason;
                const errMessage = (lastDisconnect?.error as any)?.message || '';
                const isQrTimeout = statusCode === 408 || errMessage.includes('QR refs attempts ended') || errMessage.includes('timed out');
                const isConflict = statusCode === 440 || errMessage.includes('conflict');
                const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515 || String(statusCode) === '515';
                const isLoggedOut = (statusCode === DisconnectReason.loggedOut || statusCode === 401 || String(statusCode) === '401') && !isRestartRequired;
                const isRegistered = await isSessionRegisteredOnDisk(sessionId);

                console.log(`>> [${sessionId}] Connection closed (code: ${statusCode || 'unknown'}). isRestartRequired: ${isRestartRequired}, isRegistered: ${isRegistered}`);

                if (isRestartRequired) {
                    console.log(`>> [${sessionId}] Restart required (515) following phone pairing. Reconnecting socket in 1000ms...`);
                    setTimeout(() => startWhatsAppSession(sessionId), 1000);
                } else if (isLoggedOut && isRegistered) {
                    console.log(`>> Session [${sessionId}] logged out by WhatsApp. Clearing session data...`);
                    sess!.pairingCode = null;
                    sess!.qr = null;
                    await deleteWhatsAppSession(sessionId, true).catch(() => {});
                } else if (isQrTimeout) {
                    console.log(`>> [${sessionId}] QR / Pairing timeout (408). Session idle; ready for new pairing.`);
                    sess!.qr = null;
                    sess!.pairingCode = null;
                    sess!.qrTimedOut = true;
                    // If session was never registered, clear transient pairing files so next request starts fresh
                    if (!isRegistered) {
                        await deleteWhatsAppSession(sessionId, true).catch(() => {});
                    }
                } else if (isRegistered && !isLoggedOut) {
                    const delay = isConflict ? 8000 : 3000;
                    console.log(`>> [${sessionId}] Reconnecting authenticated session in ${delay}ms...`);
                    setTimeout(() => startWhatsAppSession(sessionId), delay);
                }
            } else if (connection === 'open') {
                sess!.qr = null;
                sess!.pairingCode = null;
                sess!.qrTimedOut = false;
                sess!.isInitializing = false;
                console.log(`>> WhatsApp connected successfully! [Session: ${sessionId}]`);
                startAutoBio(currentSock);

                if (currentSock.user?.id) {
                    const userPhone = currentSock.user.id.split(':')[0];
                    const userJid = userPhone + '@s.whatsapp.net';
                    const welcomeAlreadySent = welcomeSentRecords.has(sessionId) || welcomeSentRecords.has(userPhone);

                    if (!welcomeAlreadySent) {
                        markWelcomeSent(sessionId);
                        markWelcomeSent(userPhone);
                        try {
                            const { getSessionMetadata, saveSessionMetadata } = await import('./terminalService.js');
                            let mMeta = await getSessionMetadata(sessionId);
                            if (!mMeta) {
                                const clientName = currentSock.user.name || 'DANSCOM Bot';
                                const code = Math.floor(100000 + Math.random() * 900000).toString();
                                await saveSessionMetadata(sessionId, clientName, userPhone, false, code, true);
                            } else {
                                await saveSessionMetadata(sessionId, mMeta.clientName, mMeta.clientPhone, mMeta.disabled, mMeta.controlCode, true);
                            }

                            let welcomeText = `╭━━━〔 DANSCOM BOT 〕━━━╮\n\n✅ Connection Established Successfully\n\n🤖 Bot: DANSCOM Bot\n📡 Status: Active & Online\n🔗 Session: "${sessionId}"\n📱 Number: ${userPhone}\n\nWelcome to DANSCOM Bot — your intelligent assistant for seamless automation and efficient command execution.\n\n⚙️ GETTING STARTED\nTo view the command menu and explore available features, send:\n\n➤ ".menu"\n➤ "/menu"\n\n📌 Simply send either command in this chat to get started.\n\n╰━━ DANSCOM | Smart Automation ━━╯`;
                            await currentSock.sendMessage(userJid, { text: welcomeText });
                            console.log(`>> Welcome message delivered once to ${userPhone} for session [${sessionId}] (one-time initialization)`);
                        } catch (e: any) {
                            console.error('>> Failed to send welcome message:', e.message);
                        }
                    } else {
                        console.log(`>> Session [${sessionId}] (${userPhone}) reconnected silently without repeating welcome message.`);
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
                            const isStatusViewEnabled = await isEnabled('auto_status_view', sessionId);
                            const isStatusLikeEnabled = await isEnabled('auto_status_like', sessionId);
                            
                            if (isStatusViewEnabled) {
                                await currentSock.readMessages([msg.key]).catch(() => {});
                            }
                            if (isStatusLikeEnabled && participant) {
                                await currentSock.sendMessage('status@broadcast', {
                                    react: { text: '💚', key: msg.key }
                                }, { statusJidList: [participant] }).catch(() => {});
                            }
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
    const cleanId = (sessionId || 'default_bot').trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'default_bot';
    
    // Safety check on pairing lock - if lock is active, log warning
    if (pairingLocks.get(cleanId)) {
        console.warn(`[Pairing ${cleanId}] Overriding existing lock to allow fresh pairing code generation.`);
    }
    pairingLocks.set(cleanId, true);

    try {
        let sess = sessions.get(cleanId);
        const isConnected = sess && sess.connectionState === 'open' && !!sess.sock?.user;
        
        if (isConnected) {
            throw new Error(`Device session [${cleanId}] is already connected to WhatsApp.`);
        }

        // Clean up stale or disconnected socket for this session before generating new code
        if (sess && sess.sock && sess.connectionState === 'close') {
            try { sess.sock.end(undefined); } catch (e) {}
            sess.sock = null;
        }

        // Ensure session socket is initialized
        if (!sess || !sess.sock) {
            console.log(`[Pairing ${cleanId}] Starting session socket for pairing code generation...`);
            await startWhatsAppSession(cleanId);
            sess = sessions.get(cleanId);
        }

        let retry = 0;
        while ((!sess || !sess.sock) && retry < 30) {
            await new Promise(resolve => setTimeout(resolve, 250));
            sess = sessions.get(cleanId);
            retry++;
        }

        if (!sess || !sess.sock) throw new Error(`WhatsApp socket for session [${cleanId}] failed to initialize`);
        if (sess.sock.user) throw new Error(`Device session [${cleanId}] is already connected.`);
        
        console.log(`[Pairing ${cleanId}] Waiting 2.0s for socket websocket handshake...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        let cleanNumber = number.replace(/[^0-9]/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '254' + cleanNumber.slice(1);
        }
        sess.pairingNumber = cleanNumber;
        console.log(`[Pairing ${cleanId}] Requesting pairing code for clean number: ${cleanNumber}`);
        
        let code: string | undefined = undefined;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                console.log(`[Pairing ${cleanId}] Attempt ${attempts} requesting pairing code...`);
                code = await sess.sock.requestPairingCode(cleanNumber);
                if (code) break;
            } catch (err: any) {
                console.warn(`[Pairing ${cleanId}] Attempt ${attempts} failed: ${err.message}`);
                if (attempts >= maxAttempts) {
                    throw new Error(err.message || 'Failed to request pairing code. Unable to connect to WhatsApp servers.');
                }
                const backoffMs = Math.min(1500 * Math.pow(1.5, attempts - 1), 6000);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }

        sess.pairingCode = code || null;
        sess.pairingCreatedAt = Date.now();
        console.log(`[Pairing ${cleanId}] Pairing code generated successfully: ${code}`);

        return code;
    } finally {
        pairingLocks.set(cleanId, false);
    }
};

export const startWhatsApp = async () => {
    const list = await getExistingSessions();
    console.log('>> Loading existing WhatsApp sessions:', list);
    for (const sessId of list) {
        try {
            const hasRegisteredCreds = await isSessionRegisteredOnDisk(sessId);
            if (hasRegisteredCreds) {
                console.log(`>> Bootstrapping saved device session: [${sessId}]...`);
                await startWhatsAppSession(sessId);
            } else {
                console.log(`>> Session [${sessId}] has no authenticated credentials. Idle until paired.`);
            }
        } catch (e: any) {
            console.error(`Failed to start session ${sessId}:`, e.message);
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
            // Monitor and maintain ALL device sessions with saved credentials
            const existingSessions = await getExistingSessions();
            for (const sessId of existingSessions) {
                const hasRegisteredCreds = await isSessionRegisteredOnDisk(sessId);
                // NEVER auto-reconnect unregistered sessions!
                if (!hasRegisteredCreds) continue;

                const sess = sessions.get(sessId);
                const hasPairingActive = !!(sess?.pairingCode && sess?.pairingCreatedAt && (Date.now() - sess.pairingCreatedAt < 600000));
                
                // Skip if currently pairing or actively initializing
                if (hasPairingActive || sess?.isInitializing || sess?.connectionState === 'connecting') {
                    continue;
                }

                const isConnected = sess && sess.sock && sess.connectionState === 'open' && !!sess.sock.user;
                if (!isConnected) {
                    console.log(`[Connection Monitor] Auto-reconnecting authenticated session: [${sessId}]...`);
                    await startWhatsAppSession(sessId).catch(() => {});
                }
            }
        } catch (e) {}
    }, 30000);
};

export const restartWhatsAppSession = async (sessionId: string) => {
    await deleteWhatsAppSession(sessionId);
    return await startWhatsAppSession(sessionId);
};

export const restartWhatsApp = async () => {
    return await startWhatsApp();
};

export { sock };
