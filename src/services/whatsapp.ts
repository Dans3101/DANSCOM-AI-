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

import { useFirestoreAuthState } from '../database/firestoreStore.js';
import {
    sessionsDb,
    firestoreReadyPromise,
    getIsFirestoreUsable,
    handleFirestoreError
} from '../database/firebase.js';

import { handleMessages } from '../handlers/messageHandler.js';
import { startAutoBio } from './autobio.js';
import { isEnabled } from '../utils/settings.js';
import {
    getTerminalForSession,
    initiateIntasendPayment
} from './terminalService.js';


// ============================================================
// BAILEYS SOCKET RESOLUTION
// ============================================================

const getMakeWASocket = (): any => {
    if (typeof makeWASocketImport === 'function') {
        return makeWASocketImport;
    }

    if (
        makeWASocketImport &&
        typeof (makeWASocketImport as any).default === 'function'
    ) {
        return (makeWASocketImport as any).default;
    }

    try {
        const baileysModule = require('@whiskeysockets/baileys');

        if (typeof baileysModule === 'function') {
            return baileysModule;
        }

        if (
            baileysModule &&
            typeof baileysModule.default === 'function'
        ) {
            return baileysModule.default;
        }
    } catch {
        // ESM environment - ignore
    }

    return makeWASocketImport;
};

const makeWASocket = getMakeWASocket();


// ============================================================
// TYPES
// ============================================================

export interface SessionInfo {
    sessionId: string;
    sock: WASocket | null;
    qr: string | null;
    pairingCode: string | null;
    pairingNumber: string | null;
    isInitializing: boolean;
    user: { id: string; name: string } | null;
    connectionState?: 'open' | 'connecting' | 'close' | null;

    // FIX: prevents reconnect races
    reconnectTimer?: ReturnType<typeof setTimeout> | null;

    // FIX: identifies the currently active socket
    socketGeneration?: number;
}


// ============================================================
// SESSION STORAGE
// ============================================================

const sessions = new Map<string, SessionInfo>();

let sock: WASocket | null = null;


// ============================================================
// EXISTING SESSIONS
// ============================================================

export const getExistingSessions = async (): Promise<string[]> => {
    const sessionIds = new Set<string>();

    // Always maintain the default bot
    sessionIds.add('default_bot');

    try {
        const fs = await import('fs');
        const path = await import('path');

        // Local Baileys folders
        if (fs.existsSync('.')) {
            const files = fs.readdirSync('.');

            for (const file of files) {
                if (file.startsWith('auth_info_baileys_')) {
                    const sessionId = file.replace(
                        'auth_info_baileys_',
                        ''
                    );

                    if (
                        sessionId &&
                        sessionId !== 'default_bot'
                    ) {
                        sessionIds.add(sessionId);
                    }
                }
            }
        }

        // Local Firestore fallback folders
        const fallbackPath = path.join(
            process.cwd(),
            'local_auth_fallback'
        );

        if (fs.existsSync(fallbackPath)) {
            const folders = fs.readdirSync(fallbackPath);

            for (const folder of folders) {
                if (!folder || folder === 'default_bot') {
                    continue;
                }

                const credsFile = path.join(
                    fallbackPath,
                    folder,
                    'creds.json'
                );

                if (fs.existsSync(credsFile)) {
                    sessionIds.add(folder);
                }
            }
        }
    } catch (error: any) {
        console.warn(
            'Failed to retrieve local sessions:',
            error?.message
        );
    }

    return Array.from(sessionIds);
};


// ============================================================
// CONNECTION STATE
// ============================================================

export const getConnectionState = () => {
    const def = sessions.get('default_bot');

    if (def) {
        return {
            qr: def.qr,
            pairingCode: def.pairingCode,
            connected:
                def.connectionState === 'open' &&
                !!def.sock?.user,
            pairingNumber: def.pairingNumber,
            user: def.sock?.user
                ? {
                      id: def.sock.user.id,
                      name:
                          def.sock.user.name ||
                          'DANSCOM Bot'
                  }
                : null
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
            connected:
                sess.connectionState === 'open' &&
                !!sess.sock?.user,
            pairingNumber: sess.pairingNumber,
            user: sess.sock?.user
                ? {
                      id: sess.sock.user.id,
                      name:
                          sess.sock.user.name ||
                          'DANSCOM Bot'
                  }
                : null
        });
    });

    return list;
};


// ============================================================
// RECONNECT CONTROL
// ============================================================

// FIX: Only one reconnect timer per session
const scheduleReconnect = (
    sessionId: string,
    delay = 5000
) => {
    const sess = sessions.get(sessionId);

    if (!sess) {
        return;
    }

    if (sess.reconnectTimer) {
        console.log(
            `[Reconnect ${sessionId}] Reconnect already scheduled. Skipping duplicate.`
        );
        return;
    }

    console.log(
        `[Reconnect ${sessionId}] Scheduling reconnect in ${delay}ms...`
    );

    sess.reconnectTimer = setTimeout(async () => {
        sess.reconnectTimer = null;

        const current = sessions.get(sessionId);

        if (!current) {
            return;
        }

        if (current.isInitializing) {
            console.log(
                `[Reconnect ${sessionId}] Initialization already running. Skipping.`
            );
            return;
        }

        try {
            await startWhatsAppSession(sessionId);
        } catch (error: any) {
            console.error(
                `[Reconnect ${sessionId}] Failed:`,
                error?.message
            );

            scheduleReconnect(sessionId, 10000);
        }
    }, delay);
};


// ============================================================
// PAIRING CODE
// ============================================================

export const requestPairingCode = async (
    number: string,
    sessionId = 'default_bot'
) => {
    let sess = sessions.get(sessionId);

    const cleanNumber = number.replace(/\D/g, '');

    if (!cleanNumber) {
        throw new Error('Invalid WhatsApp phone number');
    }

    const isConnected =
        !!sess &&
        sess.connectionState === 'open' &&
        !!sess.sock?.user;

    if (isConnected) {
        throw new Error('Already connected');
    }

    // FIX:
    // Do NOT delete credentials every time the user requests a code.
    // Start/reuse the socket instead.
    if (!sess) {
        await startWhatsAppSession(sessionId);
        sess = sessions.get(sessionId);
    }

    let retry = 0;

    while (
        (!sess || !sess.sock) &&
        retry < 30
    ) {
        await new Promise((resolve) =>
            setTimeout(resolve, 500)
        );

        sess = sessions.get(sessionId);
        retry++;
    }

    if (!sess?.sock) {
        throw new Error(
            'WhatsApp socket failed to initialize'
        );
    }

    if (sess.sock.user) {
        throw new Error('Already connected');
    }

    sess.pairingNumber = cleanNumber;

    console.log(
        `[Pairing ${sessionId}] Waiting for socket before requesting pairing code...`
    );

    // Keep warm-up because pairing-code requests need an active socket.
    await new Promise((resolve) =>
        setTimeout(resolve, 5000)
    );

    try {
        console.log(
            `[Pairing ${sessionId}] Requesting code for: ${cleanNumber}`
        );

        const code =
            await sess.sock.requestPairingCode(
                cleanNumber
            );

        sess.pairingCode = code || null;

        console.log(
            `[Pairing ${sessionId}] Code received: ${code}`
        );

        return code;
    } catch (error: any) {
        console.error(
            `[Pairing ${sessionId}] Error:`,
            error?.message || error
        );

        throw new Error(
            error?.message ||
                'Failed to request pairing code. Try again.'
        );
    }
};


// ============================================================
// RESTART
// ============================================================

export const restartWhatsApp = async () => {
    console.log(
        '>> Force restarting all WhatsApp connections...'
    );

    for (const sessionId of sessions.keys()) {
        try {
            await restartWhatsAppSession(sessionId);
        } catch (error: any) {
            console.error(
                `[Restart ${sessionId}]`,
                error?.message
            );
        }
    }
};


export const restartWhatsAppSession = async (
    sessionId: string
) => {
    console.log(
        `>> Force restarting WhatsApp connection for [${sessionId}]...`
    );

    const sess = sessions.get(sessionId);

    if (!sess) {
        return startWhatsAppSession(sessionId);
    }

    if (sess.reconnectTimer) {
        clearTimeout(sess.reconnectTimer);
        sess.reconnectTimer = null;
    }

    sess.isInitializing = false;
    sess.qr = null;
    sess.pairingCode = null;

    const oldSocket = sess.sock;

    sess.sock = null;
    sess.connectionState = 'close';

    if (oldSocket) {
        try {
            oldSocket.ev.removeAllListeners();
            oldSocket.end(undefined);
        } catch {
            // ignore
        }
    }

    if (sessionId === 'default_bot') {
        sock = null;
    }

    // Small delay prevents overlapping socket creation
    await new Promise((resolve) =>
        setTimeout(resolve, 1000)
    );

    return startWhatsAppSession(sessionId);
};


// ============================================================
// DELETE SESSION
// ============================================================

export const deleteWhatsAppSession = async (
    sessionId: string
) => {
    console.log(
        `>> Deleting WhatsApp session [${sessionId}]...`
    );

    const sess = sessions.get(sessionId);

    if (sess?.reconnectTimer) {
        clearTimeout(sess.reconnectTimer);
        sess.reconnectTimer = null;
    }

    if (sess?.sock) {
        try {
            sess.sock.ev.removeAllListeners();
            sess.sock.end(
                new Error('Session deleted')
            );
        } catch {
            // ignore
        }
    }

    sessions.delete(sessionId);

    if (sessionId === 'default_bot') {
        sock = null;
    }

    // Firestore cleanup
    const isReady =
        await firestoreReadyPromise;

    if (
        sessionsDb &&
        isReady &&
        getIsFirestoreUsable()
    ) {
        try {
            const snapshot =
                await sessionsDb
                    .where(
                        '__name__',
                        '>=',
                        `${sessionId}_`
                    )
                    .where(
                        '__name__',
                        '<',
                        `${sessionId}_\uf8ff`
                    )
                    .get();

            if (!snapshot.empty) {
                const docs = snapshot.docs;
                const chunkSize = 400;

                for (
                    let i = 0;
                    i < docs.length;
                    i += chunkSize
                ) {
                    const chunk = docs.slice(
                        i,
                        i + chunkSize
                    );

                    const batch =
                        sessionsDb.firestore.batch();

                    for (const doc of chunk) {
                        batch.delete(doc.ref);
                    }

                    await batch.commit();
                }

                console.log(
                    `>> [Firestore] Purged ${snapshot.size} records for ${sessionId}`
                );
            }
        } catch (error: any) {
            console.error(
                `>> Firestore cleanup failed for ${sessionId}:`,
                error?.message
            );

            handleFirestoreError(error);
        }
    }

    // Local cleanup
    try {
        const fs = await import('fs');
        const path = await import('path');

        const directories = [
            `auth_info_baileys_${sessionId}`,
            path.join(
                process.cwd(),
                'local_auth_fallback',
                sessionId
            )
        ];

        for (const dir of directories) {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, {
                    recursive: true,
                    force: true
                });

                console.log(
                    `>> Deleted local auth directory: ${dir}`
                );
            }
        }
    } catch (error: any) {
        console.error(
            '>> Local cleanup failed:',
            error?.message
        );
    }
};


// ============================================================
// START WHATSAPP SESSION
// ============================================================

export const startWhatsAppSession = async (
    sessionId: string
) => {
    let sess = sessions.get(sessionId);

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
            reconnectTimer: null,
            socketGeneration: 0
        };

        sessions.set(sessionId, sess);
    }

    // FIX:
    // Never create another socket if one is already connected.
    if (
        sess.sock &&
        sess.connectionState === 'open' &&
        sess.sock.user
    ) {
        console.log(
            `>> Session [${sessionId}] already connected.`
        );

        return sess.sock;
    }

    // FIX:
    // Prevent duplicate initialization.
    if (sess.isInitializing) {
        console.log(
            `>> Session [${sessionId}] is already initializing.`
        );

        return sess.sock;
    }

    sess.isInitializing = true;
    sess.connectionState = 'connecting';

    // FIX:
    // Every socket gets a unique generation number.
    sess.socketGeneration =
        (sess.socketGeneration || 0) + 1;

    const generation =
        sess.socketGeneration;

    try {
        console.log(
            `>> Initializing DANSCOM [Session: ${sessionId}]...`
        );

        // --------------------------------------------------------
        // BAILEYS VERSION
        // --------------------------------------------------------

        let version: [
            number,
            number,
            number
        ] = [2, 3000, 1015942434];

        try {
            const fetchPromise =
                fetchLatestBaileysVersion()
                    .catch((error) => {
                        console.warn(
                            '[Baileys version fetch]:',
                            error?.message
                        );

                        return null;
                    });

            const timeoutPromise =
                new Promise<null>((resolve) =>
                    setTimeout(
                        () => resolve(null),
                        5000
                    )
                );

            const latest =
                await Promise.race([
                    fetchPromise,
                    timeoutPromise
                ]);

            if (
                latest &&
                latest.version
            ) {
                version = latest.version;

                console.log(
                    `>> Using Baileys v${version.join('.')} | latest=${latest.isLatest}`
                );
            } else {
                console.log(
                    `>> Using fallback Baileys v${version.join('.')}`
                );
            }
        } catch (error) {
            console.warn(
                '>> Baileys version lookup failed. Using fallback.'
            );
        }


        // --------------------------------------------------------
        // AUTH STATE
        // --------------------------------------------------------

        let authState: any;

        try {
            const isReady =
                await firestoreReadyPromise;

            if (
                sessionsDb &&
                isReady &&
                getIsFirestoreUsable()
            ) {
                console.log(
                    `>> Using Firestore auth [${sessionId}]`
                );

                authState =
                    await useFirestoreAuthState(
                        sessionId
                    );
            } else {
                console.log(
                    `>> Using local auth [${sessionId}]`
                );

                authState =
                    await useMultiFileAuthState(
                        `auth_info_baileys_${sessionId}`
                    );
            }
        } catch (error: any) {
            console.error(
                '>> Auth state initialization failed:',
                error?.message
            );

            authState =
                await useMultiFileAuthState(
                    `auth_info_baileys_${sessionId}`
                );
        }

        const {
            state,
            saveCreds
        } = authState;


        // --------------------------------------------------------
        // CREATE SOCKET
        // --------------------------------------------------------

        const currentSock =
            makeWASocket({
                version,
                logger: pino({
                    level: 'silent'
                }),

                printQRInTerminal: true,

                auth: state,

                browser:
                    Browsers.macOS(
                        'Safari'
                    ),

                generateHighQualityLinkPreview:
                    true,

                syncFullHistory: false,

                markOnlineOnConnect:
                    true,

                connectTimeoutMs:
                    120000,

                keepAliveIntervalMs:
                    30000,

                qrTimeout:
                    60000,

                defaultQueryTimeoutMs:
                    60000
            });

        // FIX:
        // If another socket was created while this one was
        // initializing, don't allow the old one to take control.
        if (
            sess.socketGeneration !==
            generation
        ) {
            console.warn(
                `[${sessionId}] Stale socket detected. Closing it.`
            );

            try {
                currentSock.end(
                    new Error(
                        'Stale socket'
                    )
                );
            } catch {}

            return sess.sock;
        }

        sess.sock = currentSock;

        (currentSock as any).sessionId =
            sessionId;

        if (
            sessionId ===
            'default_bot'
        ) {
            sock = currentSock;
        }


        // --------------------------------------------------------
        // SAVE CREDENTIALS
        // --------------------------------------------------------

        currentSock.ev.on(
            'creds.update',
            saveCreds
        );


        // --------------------------------------------------------
        // CONNECTION UPDATE
        // --------------------------------------------------------

        currentSock.ev.on(
            'connection.update',
            async (update) => {
                // FIX:
                // Ignore events from an obsolete socket.
                if (
                    sess?.socketGeneration !==
                    generation
                ) {
                    return;
                }

                const {
                    connection,
                    lastDisconnect,
                    qr
                } = update;

                if (connection) {
                    sess.connectionState =
                        connection;
                }


                // ------------------------------------------------
                // QR
                // ------------------------------------------------

                if (qr) {
                    sess.qr = qr;

                    console.log(
                        `>> NEW QR Code generated [${sessionId}]`
                    );

                    try {
                        QRCode.generate(
                            qr,
                            {
                                small: true
                            }
                        );
                    } catch {
                        // ignore QR terminal errors
                    }
                }


                // ------------------------------------------------
                // CONNECTION CLOSED
                // ------------------------------------------------

                if (
                    connection ===
                    'close'
                ) {
                    const statusCode =
                        (
                            lastDisconnect
                                ?.error as Boom
                        )
                            ?.output
                            ?.statusCode;

                    const errorMessage =
                        (
                            lastDisconnect
                                ?.error as any
                        )?.message ||
                        'Unknown';

                    console.log(
                        `>> Disconnect [${sessionId}]`
                    );

                    console.log(
                        `>> Reason: ${errorMessage}`
                    );

                    console.log(
                        `>> Status: ${statusCode}`
                    );

                    sess.connectionState =
                        'close';

                    sess.qr = null;
                    sess.pairingCode = null;

                    // FIX:
                    // Only clear socket if this is still
                    // the active socket.
                    if (
                        sess.socketGeneration ===
                        generation
                    ) {
                        sess.sock = null;

                        if (
                            sessionId ===
                            'default_bot'
                        ) {
                            sock = null;
                        }
                    }


                    // ------------------------------------------------
                    // LOGGED OUT
                    // ------------------------------------------------

                    if (
                        statusCode ===
                        DisconnectReason.loggedOut
                    ) {
                        console.log(
                            `>> Session [${sessionId}] logged out.`
                        );

                        // Logged out means credentials are no
                        // longer valid. Now it is safe to delete.
                        try {
                            await deleteWhatsAppSession(
                                sessionId
                            );
                        } catch (
                            cleanupError: any
                        ) {
                            console.error(
                                `>> Logout cleanup failed [${sessionId}]:`,
                                cleanupError?.message
                            );
                        }

                        return;
                    }


                    // ------------------------------------------------
                    // 515 / RESTART REQUIRED
                    // ------------------------------------------------

                    if (
                        statusCode ===
                        DisconnectReason.restartRequired
                    ) {
                        console.log(
                            `>> 515 restartRequired detected for [${sessionId}].`
                        );

                        console.log(
                            '>> Credentials will be preserved. Creating a fresh socket...'
                        );

                        // IMPORTANT:
                        // Do NOT delete Firestore credentials here.
                        // WhatsApp may have just generated/updated
                        // credentials during pairing.

                        scheduleReconnect(
                            sessionId,
                            1500
                        );

                        return;
                    }


                    // ------------------------------------------------
                    // OTHER DISCONNECTS
                    // ------------------------------------------------

                    const shouldReconnect =
                        statusCode !==
                        DisconnectReason.loggedOut;

                    if (
                        shouldReconnect
                    ) {
                        console.log(
                            `>> Reconnecting [${sessionId}]...`
                        );

                        scheduleReconnect(
                            sessionId,
                            5000
                        );
                    }

                    return;
                }


                // ------------------------------------------------
                // CONNECTION OPEN
                // ------------------------------------------------

                if (
                    connection ===
                    'open'
                ) {
                    // FIX:
                    // Only process open for current socket.
                    if (
                        sess.socketGeneration !==
                        generation
                    ) {
                        return;
                    }

                    sess.connectionState =
                        'open';

                    sess.qr = null;
                    sess.pairingCode = null;

                    console.log(
                        `>> DANSCOM connected successfully! [Session: ${sessionId}]`
                    );

                    // Clear any pending reconnect timer
                    if (
                        sess.reconnectTimer
                    ) {
                        clearTimeout(
                            sess.reconnectTimer
                        );

                        sess.reconnectTimer =
                            null;
                    }

                    // Auto bio
                    try {
                        startAutoBio(
                            currentSock
                        );
                    } catch (
                        autoBioError: any
                    ) {
                        console.error(
                            '>> AutoBio error:',
                            autoBioError?.message
                        );
                    }


                    // ------------------------------------------------
                    // WELCOME MESSAGE
                    // ------------------------------------------------

                    if (
                        currentSock.user?.id
                    ) {
                        const userJid =
                            currentSock.user.id
                                .split(':')[0] +
                            '@s.whatsapp.net';

                        const userPhone =
                            currentSock.user.id
                                .split(':')[0];

                        try {
                            const {
                                getSessionMetadata,
                                saveSessionMetadata
                            } = await import(
                                './terminalService.js'
                            );

                            let metadata =
                                await getSessionMetadata(
                                    sessionId
                                );

                            if (!metadata) {
                                const clientName =
                                    currentSock.user
                                        .name ||
                                    'DANSCOM Bot';

                                const controlCode =
                                    Math.floor(
                                        100000 +
                                            Math.random() *
                                                900000
                                    ).toString();

                                metadata =
                                    await saveSessionMetadata(
                                        sessionId,
                                        clientName,
                                        userPhone,
                                        false,
                                        controlCode
                                    );
                            }

                            let welcomeText =
                                `🎉 *Congratulations!*\n\n` +
                                `Your *DANSCOM WhatsApp Bot* ` +
                                `(Session: \`${sessionId}\`) ` +
                                `has been successfully connected and is now fully active!\n\n` +
                                `🤖 *Bot Profile:* ${
                                    currentSock.user
                                        .name ||
                                    'DANSCOM'
                                }\n` +
                                `📱 *Number:* ${userPhone}\n\n` +
                                `Enjoy using your automated features! ` +
                                `Type /menu or .menu to test commands.`;

                            // ------------------------------------------------
                            // PAYMENT
                            // ------------------------------------------------

                            try {
                                const terminal =
                                    await getTerminalForSession(
                                        sessionId
                                    );

                                const devUrl =
                                    process.env
                                        .DEVELOPMENT_APP_URL ||
                                    process.env
                                        .SHARED_APP_URL ||
                                    'https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app';

                                if (terminal) {
                                    const setupAmount =
                                        terminal.setupFee ||
                                        0;

                                    const weeklyAmount =
                                        terminal.weeklyRate ||
                                        5;

                                    const amount =
                                        setupAmount >
                                        0
                                            ? setupAmount
                                            : weeklyAmount;

                                    const type =
                                        setupAmount >
                                        0
                                            ? 'setup'
                                            : 'weekly';

                                    try {
                                        const payment =
                                            await initiateIntasendPayment(
                                                {
                                                    amount,
                                                    email: `${userPhone}@DANSCOM.com`,
                                                    phoneNumber:
                                                        userPhone,
                                                    sessionId,
                                                    terminalId:
                                                        terminal.id,
                                                    type,
                                                    hostUrl:
                                                        devUrl
                                                }
                                            );

                                        welcomeText +=
                                            `\n\n💳 *Payment & Subscription Details*\n` +
                                            `----------------------------------------\n` +
                                            `*Terminal Group:* ${terminal.name}\n` +
                                            `*Amount due:* KES ${amount}.00 ` +
                                            `(${type === 'setup' ? 'One-time setup fee' : 'Weekly fee'})\n\n` +
                                            `Please activate your subscription:\n\n` +
                                            `🔗 *Checkout:* ${payment.checkoutUrl}\n\n` +
                                            `_Type *.checksub* after payment to verify your status._`;
                                    } catch (
                                        paymentError: any
                                    ) {
                                        console.error(
                                            '>> Payment initialization failed:',
                                            paymentError?.message
                                        );

                                        welcomeText +=
                                            `\n\n💳 *Subscription*\n` +
                                            `*Amount due:* KES ${amount}.00\n\n` +
                                            `Please visit your terminal portal to complete payment:\n\n` +
                                            `🔗 ${devUrl}?terminal=${terminal.id}`;
                                    }
                                } else {
                                    try {
                                        const payment =
                                            await initiateIntasendPayment(
                                                {
                                                    amount: 5,
                                                    email: `${userPhone}@DANSCOM.com`,
                                                    phoneNumber:
                                                        userPhone,
                                                    sessionId,
                                                    terminalId:
                                                        'main_terminal',
                                                    type:
                                                        'weekly',
                                                    hostUrl:
                                                        devUrl
                                                }
                                            );

                                        welcomeText +=
                                            `\n\n💳 *Payment & Subscription Details*\n` +
                                            `----------------------------------------\n` +
                                            `*Amount due:* KES 5.00 (Weekly subscription)\n\n` +
                                            `🔗 *Checkout:* ${payment.checkoutUrl}\n\n` +
                                            `_Type *.checksub* after payment to verify status._`;
                                    } catch (
                                        paymentError: any
                                    ) {
                                        console.error(
                                            '>> Default payment initialization failed:',
                                            paymentError?.message
                                        );
                                    }
                                }
                            } catch (
                                terminalError: any
                            ) {
                                console.error(
                                    '>> Terminal/payment check failed:',
                                    terminalError?.message
                                );
                            }


                            // ------------------------------------------------
                            // SEND WELCOME IMAGE
                            // ------------------------------------------------

                            try {
                                const fs =
                                    await import(
                                        'fs'
                                    );

                                const path =
                                    await import(
                                        'path'
                                    );

                                const imagePath =
                                    path.join(
                                        process.cwd(),
                                        'src/assets/images/titus_menu_banner_1779306614113.png'
                                    );

                                if (
                                    fs.existsSync(
                                        imagePath
                                    )
                                ) {
                                    await currentSock.sendMessage(
                                        userJid,
                                        {
                                            image:
                                                fs.readFileSync(
                                                    imagePath
                                                ),
                                            caption:
                                                welcomeText
                                        }
                                    );
                                } else {
                                    await currentSock.sendMessage(
                                        userJid,
                                        {
                                            text:
                                                welcomeText
                                        }
                                    );
                                }
                            } catch (
                                imageError: any
                            ) {
                                console.warn(
                                    '>> Welcome image failed:',
                                    imageError?.message
                                );

                                await currentSock.sendMessage(
                                    userJid,
                                    {
                                        text:
                                            welcomeText
                                    }
                                );
                            }

                            console.log(
                                `>> Welcome message sent to ${userJid}`
                            );
                        } catch (
                            welcomeError: any
                        ) {
                            console.error(
                                '>> Welcome message failed:',
                                welcomeError?.message
                            );
                        }
                    }
                }
            }
        );


        // --------------------------------------------------------
        // MESSAGES
        // --------------------------------------------------------

        currentSock.ev.on(
            'messages.upsert',
            async (messageUpdate) => {
                if (
                    messageUpdate.type !==
                    'notify'
                ) {
                    return;
                }

                try {
                    await handleMessages(
                        currentSock,
                        messageUpdate
                    );
                } catch (
                    messageError: any
                ) {
                    console.error(
                        `[Messages ${sessionId}]`,
                        messageError?.message
                    );
                }
            }
        );


        // --------------------------------------------------------
        // ANTICALL
        // --------------------------------------------------------

        currentSock.ev.on(
            'call',
            async (calls) => {
                try {
                    if (
                        !(await isEnabled(
                            'anticall',
                            sessionId
                        ))
                    ) {
                        return;
                    }

                    for (const call of calls) {
                        if (
                            call.status ===
                            'offer'
                        ) {
                            console.log(
                                `Rejecting call from ${call.from} [${sessionId}]`
                            );

                            await currentSock.rejectCall(
                                call.id,
                                call.from
                            );

                            await currentSock.sendMessage(
                                call.from,
                                {
                                    text:
                                        '⚠️ *Automatic Call Rejection*\n' +
                                        'I am currently in bot mode and cannot receive calls. ' +
                                        'Please send a message instead.'
                                }
                            );
                        }
                    }
                } catch (
                    callError: any
                ) {
                    console.error(
                        `[Anticall ${sessionId}]`,
                        callError?.message
                    );
                }
            }
        );


        return currentSock;
    } catch (error: any) {
        console.error(
            `>> WhatsApp startup failed [${sessionId}]:`,
            error?.message || error
        );

        // FIX:
        // Don't immediately create another socket here.
        // The monitor/reconnect system handles recovery.
        sess.connectionState =
            'close';

        return sess.sock;
    } finally {
        sess.isInitializing = false;
    }
};


// ============================================================
// START ALL WHATSAPP SESSIONS
// ============================================================

export const startWhatsApp = async () => {
    const list =
        await getExistingSessions();

    console.log(
        '>> Loading WhatsApp sessions:',
        list
    );

    for (const sessionId of list) {
        try {
            await startWhatsAppSession(
                sessionId
            );
        } catch (error: any) {
            console.error(
                `Failed to start ${sessionId}:`,
                error?.message
            );
        }
    }

    // Always guarantee default_bot
    if (
        !sessions.has(
            'default_bot'
        )
    ) {
        await startWhatsAppSession(
            'default_bot'
        );
    }

    startConnectionMonitor();

    return (
        sessions.get(
            'default_bot'
        )?.sock || null
    );
};


// ============================================================
// CONNECTION MONITOR
// ============================================================

let connectionMonitorInterval:
    ReturnType<typeof setInterval> | null =
    null;

const startConnectionMonitor = () => {
    if (
        connectionMonitorInterval
    ) {
        return;
    }

    console.log(
        '>> DANSCOM Connection Monitor started.'
    );

    connectionMonitorInterval =
        setInterval(async () => {
            try {
                // ------------------------------------------------
                // DEFAULT SESSION
                // ------------------------------------------------

                const def =
                    sessions.get(
                        'default_bot'
                    );

                if (!def) {
                    console.log(
                        '[Monitor] default_bot missing. Starting...'
                    );

                    await startWhatsAppSession(
                        'default_bot'
                    );

                    return;
                }

                // IMPORTANT:
                // If a reconnect timer exists, don't start
                // another socket.
                if (
                    def.reconnectTimer
                ) {
                    return;
                }

                if (
                    !def.sock &&
                    !def.isInitializing
                ) {
                    console.log(
                        '[Monitor] default_bot socket missing. Reviving...'
                    );

                    await startWhatsAppSession(
                        'default_bot'
                    );
                }


                // ------------------------------------------------
                // OTHER SESSIONS
                // ------------------------------------------------

                const activeSessions =
                    await getExistingSessions();

                for (
                    const sessionId of activeSessions
                ) {
                    if (
                        sessionId ===
                        'default_bot'
                    ) {
                        continue;
                    }

                    const session =
                        sessions.get(
                            sessionId
                        );

                    if (!session) {
                        await startWhatsAppSession(
                            sessionId
                        );

                        continue;
                    }

                    if (
                        session.reconnectTimer
                    ) {
                        continue;
                    }

                    if (
                        !session.sock &&
                        !session.isInitializing
                    ) {
                        await startWhatsAppSession(
                            sessionId
                        );
                    }
                }
            } catch (
                monitorError: any
            ) {
                console.error(
                    '[Connection Monitor Error]:',
                    monitorError?.message
                );
            }
        }, 30000);
};


// ============================================================
// EXPORT DEFAULT SOCKET
// ============================================================

export { sock };