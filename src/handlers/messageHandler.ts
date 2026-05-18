import { WASocket, proto } from '@whiskeysockets/baileys';
import { isEnabled } from '../utils/settings.js';
import { config } from '../config/index.js';
import { processCommand } from '../commands/index.js';
import { geminiAssistant } from '../services/gemini.js';
import { storeMessage, getMessage } from '../utils/messageStore.js';
import { saveContact } from '../services/contactService.js';

export const handleMessages = async (sock: WASocket, upsert: { messages: any[] }) => {
  for (const msg of upsert.messages) {
    if (!msg.message) continue;
    
    // Auto status view
    if (msg.key?.remoteJid === 'status@broadcast') {
      if (await isEnabled('auto_status_view')) {
        await sock.readMessages([msg.key]);
        console.log(`Viewed status from ${msg.pushName || msg.key.participant}`);
        
        if (await isEnabled('auto_status_like')) {
          const emojis = ['❤️', '🔥', '🙌', '💯', '✨'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          await sock.sendMessage(msg.key.remoteJid, {
            react: { text: randomEmoji, key: msg.key }
          });
        }
      }
      continue;
    }

    const m = msg as any;
    const from = m.key.remoteJid!;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? m.key.participant! : from;

    // Auto Save Contacts
    if (await isEnabled('auto_save_contacts') && !isGroup) {
        await saveContact(sender, m.pushName);
    }

    // Store message for deleted message detection
    if (m.message && !m.message.protocolMessage) {
        storeMessage(m.key.id!, sender, m.message);
    }

    // Detecting deleted messages
    if (m.message.protocolMessage?.type === 0) { // REVOKE
        if (await isEnabled('see_deleted_messages')) {
            const deletedId = m.message.protocolMessage.key.id;
            const originalMsg = getMessage(deletedId);
            if (originalMsg) {
                const ownerJid = config.bot.ownerNumber + '@s.whatsapp.net';
                await sock.sendMessage(ownerJid, {
                    text: `🗑️ *Deleted Message Detected!*\nFrom: ${originalMsg.sender}\n\n*Content:*`
                });
                await sock.sendMessage(ownerJid, { forward: { key: { id: deletedId, remoteJid: from, participant: originalMsg.sender }, message: originalMsg.message } });
            }
        }
    }

    // View Once Media Saving
    const viewOnceMsg = m.message.viewOnceMessageV2?.message || m.message.viewOnceMessage?.message;
    if (viewOnceMsg && await isEnabled('save_view_once')) {
        const ownerJid = config.bot.ownerNumber + '@s.whatsapp.net';
        await sock.sendMessage(ownerJid, { text: `📸 *View Once Media Detected from ${sender}*` });
        await sock.sendMessage(ownerJid, { forward: m });
    }

    const body = m.message.conversation || 
                 m.message.extendedTextMessage?.text || 
                 m.message.imageMessage?.caption || 
                 m.message.videoMessage?.caption || '';
    
    const isOwner = sender.includes(config.bot.ownerNumber);
    const prefix = config.bot.prefix;
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const args = isCmd ? body.slice(prefix.length + command.length).trim().split(' ') : [];

    // Presence updates
    if (await isEnabled('fake_typing')) {
        await sock.sendPresenceUpdate('composing', from);
    }
    if (await isEnabled('fake_recording')) {
        await sock.sendPresenceUpdate('recording', from);
    }

    // Auto Read
    if (await isEnabled('auto_read')) {
      await sock.readMessages([m.key]);
    }

    // Command Handler
    if (isCmd) {
      await processCommand(sock, m, command, args, { isOwner, isGroup, sender });
    } else {
      // AI Smart Reply if enabled
      if (await isEnabled('ai_smart_reply') && !m.key.fromMe) {
        // Only reply if mentioned or in private chat
        if (!isGroup || body.toLowerCase().includes('bot')) {
            const reply = await geminiAssistant(body);
            if (reply) {
                await sock.sendMessage(from, { text: reply }, { quoted: m });
            }
        }
      }
    }
  }
};
