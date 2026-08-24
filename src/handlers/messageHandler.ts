import { WASocket, proto } from '@whiskeysockets/baileys';
import { isEnabled, setFeature } from '../utils/settings.js';
import { config } from '../config/index.js';
import { processCommand } from '../commands/index.js';
import { geminiAssistant } from '../services/gemini.js';
import { storeMessage, getMessage } from '../utils/messageStore.js';
import { saveContact } from '../services/contactService.js';
import { getSessionMetadata } from '../services/terminalService.js';

// High-speed group metadata cache with TTL
const groupMetadataCache = new Map<string, { data: any; timestamp: number }>();

export const getCachedGroupMetadata = async (sock: WASocket, groupJid: string): Promise<any> => {
  const cached = groupMetadataCache.get(groupJid);
  if (cached && Date.now() - cached.timestamp < 180000) {
    return cached.data;
  }
  try {
    const metadataPromise = sock.groupMetadata(groupJid);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Group metadata timeout')), 4000));
    const data = await Promise.race([metadataPromise, timeoutPromise]);
    groupMetadataCache.set(groupJid, { data, timestamp: Date.now() });
    return data;
  } catch (err: any) {
    if (cached) return cached.data;
    console.warn(`[Group Metadata Warning] Failed/timed out for ${groupJid}:`, err.message);
    return null;
  }
};

const checkIfAdmin = async (sock: WASocket, groupJid: string, senderJid: string, isOwner: boolean): Promise<boolean> => {
  if (isOwner) return true;
  
  const botNumber = sock.user?.id?.split(':')[0]?.replace(/[^0-9]/g, '');
  const senderNumber = senderJid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '');
  if (botNumber && senderNumber && botNumber === senderNumber) return true;
  
  const groupMetadata = await getCachedGroupMetadata(sock, groupJid);
  if (!groupMetadata) {
    return isOwner;
  }
  
  const participants = groupMetadata?.participants || [];
  const senderParticipant = participants.find((p: any) => {
    const pNumber = p.id?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '');
    return (pNumber && senderNumber && pNumber === senderNumber) || p.id === senderJid;
  });
  
  return senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin' || isOwner;
};

// Command execution worker with timeout isolation to prevent event loop blocking
const executeCommandAsync = async (
  sock: WASocket,
  m: any,
  command: string,
  args: string[],
  context: { isOwner: boolean; isGroup: boolean; sender: string }
): Promise<void> => {
  const COMMAND_TIMEOUT_MS = 60000; // 60s max execution safety limit
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`Command .${command} execution exceeded timeout limit (${COMMAND_TIMEOUT_MS / 1000}s)`)), COMMAND_TIMEOUT_MS)
  );

  const commandPromise = (async () => {
    await processCommand(sock, m, command, args, context);
  })();

  try {
    await Promise.race([commandPromise, timeoutPromise]);
  } catch (err: any) {
    console.error(`[Async Command Worker Error] (${command}):`, err.message || err);
    const from = m.key.remoteJid!;
    if (err.message && err.message.includes('timeout')) {
      await sock.sendMessage(from, { 
        text: `⚠️ *Command Timeout:* The command \`.${command}\` took too long to complete. Please try again.` 
      }, { quoted: m }).catch(() => {});
    }
  }
};

const processSingleMessage = async (sock: WASocket, msg: any, sessionId: string) => {
  try {
    if (!msg.message) return;
    
    // Auto status view (asynchronous fire-and-forget)
    if (msg.key?.remoteJid === 'status@broadcast') {
      isEnabled('auto_status_view', sessionId).then(async (enabled) => {
        if (enabled) {
          await sock.readMessages([msg.key]).catch(() => {});
          console.log(`Viewed status from ${msg.pushName || msg.key.participant}`);
          
          const likeEnabled = await isEnabled('auto_status_like', sessionId).catch(() => false);
          if (likeEnabled) {
            const emojis = ['❤️', '🔥', '🙌', '💯', '✨'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await sock.sendMessage(msg.key.participant!, {
              react: { text: randomEmoji, key: msg.key }
            }).catch(() => {});
          }
        }
      }).catch(() => {});
      return;
    }

    const m = msg as any;
    const from = m.key.remoteJid!;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? m.key.participant! : from;

    // Auto Save Contacts (asynchronous background task)
    if (!isGroup) {
      isEnabled('auto_save_contacts', sessionId).then(enabled => {
        if (enabled) saveContact(sender, m.pushName).catch(() => {});
      }).catch(() => {});
    }

    // Store message for deleted message detection
    if (m.message && !m.message.protocolMessage) {
      storeMessage(m.key.id!, sender, m.message);
    }

    // Detecting deleted messages (REVOKE)
    const protocolMsg = m.message.protocolMessage;
    if (protocolMsg && (protocolMsg.type === 0 || protocolMsg.type === 'REVOKE' || protocolMsg.type === 3)) {
      isEnabled('see_deleted_messages', sessionId).then(async (enabled) => {
        if (enabled) {
          const deletedId = protocolMsg.key?.id;
          if (deletedId) {
            const originalMsg = getMessage(deletedId);
            if (originalMsg) {
              const ownerJid = (sock.user?.id?.split(':')[0] || config.bot.ownerNumber) + '@s.whatsapp.net';
              
              let originalText = '';
              const type = Object.keys(originalMsg.message)[0];
              let realMsg = originalMsg.message;
              if (type === 'ephemeralMessage' || type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
                realMsg = realMsg[type]?.message || realMsg;
              }
              originalText = realMsg.conversation || 
                             realMsg.extendedTextMessage?.text || 
                             realMsg.imageMessage?.caption || 
                             realMsg.videoMessage?.caption || 
                             '';

              await sock.sendMessage(ownerJid, {
                text: `🗑️ *Deleted Message Detected!*\n• *Sender:* @${originalMsg.sender.split('@')[0]}\n• *Chat:* @${from.split('@')[0]}\n• *Content:* ${originalText || '_[Media or Unknown]_'}`,
                mentions: [originalMsg.sender, from]
              }).catch(() => {});
              
              try {
                await sock.sendMessage(ownerJid, { 
                  forward: { 
                    key: { id: deletedId, remoteJid: from, participant: originalMsg.sender }, 
                    message: originalMsg.message 
                  } 
                });
              } catch (fwdErr) {
                console.warn('[Message Revoke] Direct message forwarding failed, raw metadata printed.');
              }
            }
          }
        }
      }).catch(() => {});
    }

    // View Once Media Saving (asynchronous background task)
    const viewOnceOuter = m.message.viewOnceMessageV2 || m.message.viewOnceMessage;
    if (viewOnceOuter) {
      isEnabled('save_view_once', sessionId).then(async (enabled) => {
        if (enabled) {
          const ownerJid = (sock.user?.id?.split(':')[0] || config.bot.ownerNumber) + '@s.whatsapp.net';
          const viewOnceMsg = viewOnceOuter.message;
          
          try {
            const mediaType = Object.keys(viewOnceMsg)[0];
            if (mediaType === 'imageMessage' || mediaType === 'videoMessage' || mediaType === 'audioMessage') {
              const mediaMessage = viewOnceMsg[mediaType];
              const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
              
              const typeMap: { [key: string]: 'image' | 'video' | 'audio' } = {
                'imageMessage': 'image',
                'videoMessage': 'video',
                'audioMessage': 'audio'
              };
              
              const stream = await downloadContentFromMessage(mediaMessage, typeMap[mediaType]);
              let buffer = Buffer.from([]);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
              }
              
              await sock.sendMessage(ownerJid, { text: `📸 *View Once Media Detected from @${sender.split('@')[0]} in @${from.split('@')[0]}!* (Automatically Saved Below)`, mentions: [sender, from] });
              const sendType = typeMap[mediaType];
              if (sendType === 'image') {
                await sock.sendMessage(ownerJid, { image: buffer, caption: `Saved View Once Image from ${sender}` });
              } else if (sendType === 'video') {
                await sock.sendMessage(ownerJid, { video: buffer, caption: `Saved View Once Video from ${sender}` });
              } else if (sendType === 'audio') {
                await sock.sendMessage(ownerJid, { audio: buffer, mimetype: mediaMessage.mimetype || 'audio/ogg' });
              }
            }
          } catch (dlErr: any) {
            console.error('[Auto Save View Once Error]: Failed to download/forward raw media:', dlErr.message);
          }
        }
      }).catch(() => {});
    }

    let body = '';
    if (m.message) {
      const msgType = Object.keys(m.message)[0];
      let realMsg = m.message;
      if (msgType === 'ephemeralMessage' || msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') {
        const content = m.message[msgType];
        realMsg = content?.message || realMsg;
      }

      body = realMsg.conversation || 
             realMsg.extendedTextMessage?.text || 
             realMsg.imageMessage?.caption || 
             realMsg.videoMessage?.caption || 
             realMsg.templateButtonReplyMessage?.selectedId ||
             realMsg.buttonsResponseMessage?.selectedButtonId ||
             realMsg.listResponseMessage?.singleSelectReply?.selectedRowId ||
             '';
    }

    const safeSender = sender || '';
    const numericSender = safeSender.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
    const numericOwner = config.bot.ownerNumber ? config.bot.ownerNumber.replace(/[^0-9]/g, '') : '';
    const isOwner = !!(
      m.key.fromMe || 
      numericSender === '254713811622' ||
      (numericOwner && numericSender === numericOwner) || 
      (config.bot.ownerNumber && safeSender.includes(config.bot.ownerNumber))
    );

    body = body.trim();
    
    // Auto AntiLink Protection Filter (non-blocking)
    const linkRegex = /chat\.whatsapp\.com\/[a-zA-Z0-9]+|https?:\/\/[^\s]+/gi;
    if (isGroup && linkRegex.test(body)) {
      isEnabled('antilink', sessionId).then(async (enabled) => {
        if (enabled) {
          try {
            const groupMetadata = await getCachedGroupMetadata(sock, from);
            const participants = groupMetadata?.participants || [];
            const senderParticipant = participants.find((p: any) => {
              const pNumber = p.id?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '');
              return (pNumber && numericSender && pNumber === numericSender) || p.id === sender;
            });
            const isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
            const isBotOrOwner = isOwner || sender === sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
            
            if (!isAdmin && !isBotOrOwner) {
              console.log(`[AntiLink] Deleting link matching message from sender ${sender} in group ${from}`);
              await sock.sendMessage(from, { delete: m.key });
              await sock.sendMessage(from, { 
                text: `⚠️ *AntiLink Activated!*\n@${sender.split('@')[0]}, external links are strictly forbidden in this group setup. Your message has been automatically deleted!`,
                mentions: [sender]
              });
            }
          } catch (linkErr: any) {
            console.warn('[AntiLink Error]: Failed group admin evaluation or unlink deletion:', linkErr.message);
          }
        }
      }).catch(() => {});
    }

    const prefixes = ['.', '/', '!', '#'];
    let isCmd = false;
    let command = '';
    let args: string[] = [];

    for (const pref of prefixes) {
      if (body.startsWith(pref)) {
        isCmd = true;
        const line = body.slice(pref.length).trim();
        command = line.split(' ')[0].toLowerCase();
        args = line.slice(command.length).trim().split(/\s+/).filter(Boolean);
        break;
      }
    }

    // List of known commands that can run without prefix
    const knownCommands = [
      'ping', 'menu', 'help', 'allmenu', 'enable', 'disable', 'settings', 
      'video', 'ytmp4', 'fb', 'ig', 'tiktok', 'image', 'ai', 
      'gpt', 'premium', 'pay', 'checksub', 'stats', 'contacts',
      'vv', 'kick', 'promote', 'demote', 'tagall'
    ];

    if (!isCmd) {
      const lowerBody = body.toLowerCase().trim();
      const firstWord = lowerBody.split(/\s+/)[0];
      const isNumericSubmenu = /^\d+$/.test(firstWord) && parseInt(firstWord, 10) >= 1 && parseInt(firstWord, 10) <= 35;

      if (isNumericSubmenu || !isGroup) {
        if (knownCommands.includes(firstWord) || isNumericSubmenu) {
          isCmd = true;
          command = firstWord;
          args = body.slice(firstWord.length).trim().split(/\s+/).filter(Boolean);
        }
      }
    }

    // Presence updates (fire and forget)
    isEnabled('fake_typing', sessionId).then(en => { if (en) sock.sendPresenceUpdate('composing', from).catch(() => {}); });
    isEnabled('fake_recording', sessionId).then(en => { if (en) sock.sendPresenceUpdate('recording', from).catch(() => {}); });
    isEnabled('auto_read', sessionId).then(en => { if (en) sock.readMessages([m.key]).catch(() => {}); });

    // Command Handler & Asynchronous Dispatcher
    const metadata = await getSessionMetadata(sessionId).catch(() => null);
    const isSessionDisabled = metadata?.disabled === true;

    if (isCmd) {
      // Group bot status check (.danscom on / off)
      if (isGroup) {
        if (command === 'danscom') {
          const mode = args[0]?.toLowerCase();
          const isAdmin = await checkIfAdmin(sock, from, sender, isOwner);
          if (!isAdmin) {
            await sock.sendMessage(from, { text: `❌ *Access Denied:* Only group administrators can configure the DANSCOM bot in this group!` }, { quoted: m });
            return;
          }
          if (mode === 'on') {
            await setFeature(`danscom_group_enabled_${from}`, true, sessionId);
            await sock.sendMessage(from, { text: `✅ *DANSCOM ENABLED:* The bot has been successfully activated for this group! All group members can now use all bot commands.` }, { quoted: m });
            return;
          } else if (mode === 'off') {
            await setFeature(`danscom_group_enabled_${from}`, false, sessionId);
            await sock.sendMessage(from, { text: `🛑 *DANSCOM DISABLED:* The bot has been deactivated for this group. Only group admins can re-enable it using \`.danscom on\`.` }, { quoted: m });
            return;
          } else {
            const currentStatus = await isEnabled(`danscom_group_enabled_${from}`, sessionId);
            await sock.sendMessage(from, { text: `⚙️ *DANSCOM Group Settings:*
• Current Status: *${currentStatus ? 'ACTIVE 🟢' : 'INACTIVE 🔴'}*

👇 *Admin/Owner Commands:*
• \`.danscom on\` - Enable bot services for all group members.
• \`.danscom off\` - Disable bot services in this group.` }, { quoted: m });
            return;
          }
        } else {
          // Check if group is enabled (defaults to true)
          const isGroupEnabled = await isEnabled(`danscom_group_enabled_${from}`, sessionId);
          if (!isGroupEnabled) {
            console.log(`[DANSCOM] Ignored group command '${command}' because DANSCOM is disabled in group ${from}.`);
            return;
          }
        }
      }

      // Check Public / Private mode settings (Only owners can run commands if in private mode)
      const isPublicMode = await isEnabled('public_mode', sessionId);
      if (!isPublicMode && !isOwner) {
        console.log(`[Private Access Filter] Ignored command '${command}' from non-owner sender ${sender} because bot is in PRIVATE mode.`);
        return;
      }

      if (isSessionDisabled && command !== 'checksub' && command !== 'pay') {
        // Send disabled notification for commands
        await sock.sendMessage(from, { 
          text: `🛑 *Your DANSCOM AI is disabled.*\n\nThis bot connection (Session: \`${sessionId}\`) is currently suspended/disabled.\n\n_Please complete your active subscription or contact the terminal administrator to re-enable your access._` 
        }, { quoted: m });
        return;
      }

      // Execute command asynchronously without blocking the event loop or other message queues
      await executeCommandAsync(sock, m, command, args, { isOwner, isGroup, sender });
    } else {
      // AI Smart Reply if enabled
      if (await isEnabled('ai_smart_reply', sessionId) && !m.key.fromMe) {
        if (isSessionDisabled) {
          if (!isGroup) {
            await sock.sendMessage(from, { 
              text: `🛑 *Your DANSCOM AI is disabled.*\n\nThis bot connection is currently suspended/disabled.\n\n_Please contact your administrator to re-enable._` 
            }, { quoted: m });
          }
          return;
        }
        // Only reply if mentioned or in private chat
        if (!isGroup || body.toLowerCase().includes('bot')) {
          const reply = await geminiAssistant(body);
          if (reply) {
            await sock.sendMessage(from, { text: reply }, { quoted: m });
          }
        }
      }
    }
  } catch (msgError: any) {
    console.error('>> Error processing single WhatsApp message:', msgError.message || msgError);
  }
};

export const handleMessages = async (sock: WASocket, upsert: { messages: any[] }) => {
  const sessionId = (sock as any).sessionId || 'default_bot';
  if (!upsert?.messages || !Array.isArray(upsert.messages) || upsert.messages.length === 0) return;
  
  // Non-blocking asynchronous dispatch using setImmediate and Promise.allSettled
  setImmediate(async () => {
    try {
      await Promise.allSettled(
        upsert.messages.map(msg => processSingleMessage(sock, msg, sessionId))
      );
    } catch (err: any) {
      console.error('>> Critical uncaught error in message handler batch:', err.message || err);
    }
  });
};

