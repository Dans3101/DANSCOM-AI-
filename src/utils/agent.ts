import admin from 'firebase-admin';
import { db } from '../database/firebase.js';

export async function agentHandler(from: string, sock: any, args: string[], m: any) {
    if (!db) {
        return sock.sendMessage(from, { text: '⚠️ *Agent Error:* Database is not initialized.' }, { quoted: m });
    }
    const userId = from;
    const sessionRef = db.collection('agent_sessions').doc(userId);
    const sessionDoc = await sessionRef.get();
    const sessionData = sessionDoc.exists ? sessionDoc.data() : null;

    if (!args[0] || ['connect', 'chat', 'pull', 'broadcast'].includes(args[0])) {
        // Start or continue a form
        if (!sessionData) {
            await sessionRef.set({ step: 'platforms', data: { taskType: args[0] || 'broadcast', url: args[1] || '' }, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            return sock.sendMessage(from, { text: `🤖 *Agent Form (${args[0] || 'Broadcast'})*\n\nStep 1/3: Specify *Platforms* to broadcast to (e.g., WhatsApp, Discord) - separated by commas.` }, { quoted: m });
        }
    }

    if (sessionData) {
        const step = sessionData.step;
        const msg = args.join(' ');
        const data = sessionData.data;

        if (step === 'platforms') {
            await sessionRef.update({ step: 'time', 'data.platforms': msg.split(',').map(p => p.trim()) });
            return sock.sendMessage(from, { text: 'Step 2/3: Please provide the *Scheduled Time* for broadcast (e.g., 2026-06-09 10:00).' }, { quoted: m });
        } else if (step === 'time') {
            await sessionRef.update({ step: 'confirm', 'data.scheduledTime': msg });
            return sock.sendMessage(from, { text: `Step 3/3: Confirm broadcast to ${data.platforms.join(', ')} at ${msg}? (Type "yes" to confirm)` }, { quoted: m });
        } else if (step === 'confirm' && msg.toLowerCase() === 'yes') {
            await sessionRef.delete();
            // In a real app, schedule the job here.
            await sock.sendMessage(from, { text: `✅ *Agent Task Scheduled!*\n\nTask: ${data.taskType}\nPlatforms: ${data.platforms.join(', ')}\nTime: ${data.scheduledTime}\n\nInformation will be processed and broadcast automatically.` }, { quoted: m });
            return true;
        }
    }

    return sock.sendMessage(from, { text: '⚠️ *Multi-tenant Agent:*\nUse .agent [connect/chat/pull] [url/msg] to start a task.' }, { quoted: m });
}
