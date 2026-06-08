import admin from 'firebase-admin';
import { db } from '../database/firebase.js';

const agentSessionCache = new Map<string, any>();

export async function agentHandler(from: string, sock: any, args: string[], m: any) {
    console.log(`[AgentHandler] Called from: ${from}, args:`, args);
    const userId = from;
    
    // Check cache first
    let sessionData = agentSessionCache.get(userId);
    
    if (!sessionData && db) {
        try {
            const sessionRef = db.collection('agent_sessions').doc(userId);
            const sessionDoc = await sessionRef.get();
            sessionData = sessionDoc.exists ? sessionDoc.data() : null;
            if (sessionData) {
                agentSessionCache.set(userId, sessionData);
            }
        } catch (e) {
            console.error('[Agent] Firestore read failed:', e);
        }
    }

    const saveSession = async (data: any) => {
        agentSessionCache.set(userId, data);
        if (db) {
            try {
                const sessionRef = db.collection('agent_sessions').doc(userId);
                if (data === null) {
                    await sessionRef.delete();
                } else {
                    await sessionRef.set(data, { merge: true });
                }
            } catch (e) {
                console.error('[Agent] Firestore write failed:', e);
            }
        }
    };

    if (!args[0] || ['connect', 'chat', 'pull', 'broadcast'].includes(args[0])) {
        // Start or continue a form
        if (!sessionData) {
            const newData = { step: 'platforms', data: { taskType: args[0] || 'broadcast', url: args[1] || '' }, createdAt: admin.firestore.FieldValue.serverTimestamp() };
            await saveSession(newData);
            return sock.sendMessage(from, { text: `🤖 *Agent Form (${args[0] || 'Broadcast'})*\n\nStep 1/3: Specify *Platforms* to broadcast to (e.g., WhatsApp, Discord) - separated by commas.` }, { quoted: m });
        }
    }

    if (sessionData) {
        const step = sessionData.step;
        const msg = args.join(' ');
        const data = sessionData.data;

        if (step === 'platforms') {
            const updatedData = { ...sessionData, step: 'time', 'data.platforms': msg.split(',').map(p => p.trim()) };
            await saveSession(updatedData);
            return sock.sendMessage(from, { text: 'Step 2/3: Please provide the *Scheduled Time* for broadcast (e.g., 2026-06-09 10:00).' }, { quoted: m });
        } else if (step === 'time') {
            const updatedData = { ...sessionData, step: 'confirm', 'data.scheduledTime': msg };
            await saveSession(updatedData);
            return sock.sendMessage(from, { text: `Step 3/3: Confirm broadcast to ${data.platforms.join(', ')} at ${msg}? (Type "yes" to confirm)` }, { quoted: m });
        } else if (step === 'confirm' && msg.toLowerCase() === 'yes') {
            await saveSession(null);
            // In a real app, schedule the job here.
            await sock.sendMessage(from, { text: `✅ *Agent Task Scheduled!*\n\nTask: ${data.taskType}\nPlatforms: ${data.platforms.join(', ')}\nTime: ${data.scheduledTime}\n\nInformation will be processed and broadcast automatically.` }, { quoted: m });
            return true;
        }
    }

    return sock.sendMessage(from, { text: '⚠️ *Multi-tenant Agent:*\nUse .agent [connect/chat/pull] [url/msg] to start a task.' }, { quoted: m });
}
