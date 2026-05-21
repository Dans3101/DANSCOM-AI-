import { WASocket, proto } from '@whiskeysockets/baileys';
import { setFeature, isEnabled } from '../utils/settings.js';
import { geminiAssistant } from '../services/gemini.js';
import { analyticsDb, premiumDb, contactsDb, getIsFirestoreUsable } from '../database/firebase.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

export const processCommand = async (
  sock: WASocket, 
  m: any, 
  command: string, 
  args: string[], 
  context: { isOwner: boolean, isGroup: boolean, sender: string }
) => {
  const from = m.key.remoteJid!;
  
  // Track analytics defensively
  if (getIsFirestoreUsable() && analyticsDb) {
    try {
      await analyticsDb.doc(command).set({
        usageCount: admin.firestore.FieldValue.increment(1),
        lastUsed: admin.firestore.Timestamp.now()
      }, { merge: true }).catch(() => {});
    } catch (e: any) {
      console.warn('[Analytics Error]: Failed to track analytics in Firestore:', e.message);
    }
  }

  try {
    switch (command) {
      case 'menu':
      case 'help':
        const menuText = `🤖 *DANSCOM MULTI-DEVICE BOT* 🤖
_AI Solutions for a Smarter Future_

*COMMANDS MENU LIST:*

📱 *User Commands:*
• *.menu* or *.help* - Display this list of commands.
• *.ping* - Check bot latency and online status.
• *.ai [prompt]* - Meet your Gemini AI assistant.
• *.image [desc]* - Generate custom intelligence imagery.
• *.settings* - View status of automated features.

📥 *Downloader Utilities:*
• *.video [url]* / *.ytmp4* - Get YouTube video files.
• *.fb [url]* - Obtain Facebook video streams.
• *.ig [url]* - Keep Instagram media locally.
• *.tiktok [url]* - Get TikTok video copies.

🌟 *Sub-Accounts & Tiers:*
• *.premium* - Read benefits of premium plans.
• *.pay* - Get payment support instructions.
• *.checksub* - View active subscription state.

🛠️ *Admin Controls:*
• *.enable [feature]* - Activate automated background processes.
• *.disable [feature]* - Turn off background processes.
• *.stats* - Review system load and command charts.
• *.contacts* - List automatically saved phone contacts.

⚡ *Togglable Automation Features:*
_auto_read, auto_status_view, auto_status_like, ai_smart_reply, anticall, auto_bio, fake_typing, fake_recording, see_deleted_messages, save_view_once_

_Powered by DANSCOM AI Solutions_`.trim();

        try {
          const imagePath = path.join(process.cwd(), 'src/assets/images/danscom_menu_banner_1779306614113.png');
          if (fs.existsSync(imagePath)) {
            await sock.sendMessage(from, {
              image: fs.readFileSync(imagePath),
              caption: menuText
            }, { quoted: m });
          } else {
            await sock.sendMessage(from, { text: menuText }, { quoted: m });
          }
        } catch (err: any) {
          console.error('Failed to send menu image banner, falling back to text:', err.message);
          await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }
        break;

      case 'ping':
        await sock.sendMessage(from, { text: 'Pong! 🏓' }, { quoted: m });
        break;

      case 'enable':
      case 'disable':
        if (!context.isOwner) return sock.sendMessage(from, { text: 'Owner only command!' }, { quoted: m });
        if (args.length === 0) return sock.sendMessage(from, { text: 'Please specify a feature!' }, { quoted: m });
        const feature = args[0];
        const value = command === 'enable';
        await setFeature(feature, value);
        await sock.sendMessage(from, { text: `Feature *${feature}* has been ${value ? 'enabled' : 'disabled'}! ✅` }, { quoted: m });
        break;

      case 'settings':
        const features = [
          'auto_read',
          'auto_status_view',
          'auto_status_like',
          'ai_smart_reply',
          'anticall',
          'auto_bio',
          'fake_typing',
          'fake_recording',
          'see_deleted_messages',
          'save_view_once'
        ];
        let settingsText = '🛠️ *Bot Feature Controls:* 🛠️\n\n';
        for (const feat of features) {
          const enabled = await isEnabled(feat);
          settingsText += `${enabled ? '✅' : '❌'} *${feat}*\n`;
        }
        settingsText += '\nUse *.enable [feature]* or *.disable [feature]* to toggle.';
        await sock.sendMessage(from, { text: settingsText }, { quoted: m });
        break;

      case 'video':
      case 'ytmp4':
      case 'fb':
      case 'ig':
      case 'tiktok':
        const url = args[0];
        if (!url) return sock.sendMessage(from, { text: 'Please provide a URL!' }, { quoted: m });
        await sock.sendMessage(from, { text: '⏳ *Processing your request...* 📥\nThis may take a moment depending on the media size.' }, { quoted: m });
        await sock.sendMessage(from, { text: '❌ *Download Error:* This service requires a premium Downloader API key. (Placeholder)' }, { quoted: m });
        break;

      case 'image':
        const promptImg = args.join(' ');
        if (!promptImg) return sock.sendMessage(from, { text: 'Please provide an image description!' }, { quoted: m });
        await sock.sendMessage(from, { text: '🎨 *Generating your image...* 🖌️' }, { quoted: m });
        await sock.sendMessage(from, { text: '❌ *Generation Error:* OpenAI API key (DALL-E) is missing in .env.' }, { quoted: m });
        break;

      case 'ai':
      case 'gpt':
        const prompt = args.join(' ');
        if (!prompt) return sock.sendMessage(from, { text: 'Please provide a prompt!' }, { quoted: m });
        const aiResponse = await geminiAssistant(prompt);
        await sock.sendMessage(from, { text: aiResponse || 'AI Error' }, { quoted: m });
        break;

      case 'premium':
        await sock.sendMessage(from, { text: '🌟 *Premium Features:* 🌟\n- AI Image Generation\n- Unlimited Downloads\n- Priority Support\n\nPay 5 KSH weekly to join. Type *.pay*' }, { quoted: m });
        break;

      case 'pay':
        await sock.sendMessage(from, { text: 'To pay, send 5 KSH to M-Pesa Number: *0712345678* and send the screenshot here. (Verification is manual for now)' }, { quoted: m });
        break;

      case 'checksub':
        if (!getIsFirestoreUsable() || !premiumDb) {
          return sock.sendMessage(from, { text: 'Database is currently offline. Showing premium pricing details instead. Type *.premium* to view tiers.' }, { quoted: m });
        }
        try {
          const subDoc = await premiumDb.doc(context.sender.split(':')[0]).get();
          if (subDoc.exists && subDoc.data()?.expiry.toDate() > new Date()) {
            await sock.sendMessage(from, { text: `You are a premium user! valid until: ${subDoc.data()?.expiry.toDate().toLocaleString()}` }, { quoted: m });
          } else {
            await sock.sendMessage(from, { text: 'You are on the free plan.' }, { quoted: m });
          }
        } catch (dbErr: any) {
          await sock.sendMessage(from, { text: 'Database connection failed. Free plan active temporarily.' }, { quoted: m });
        }
        break;

      case 'stats':
        if (!context.isOwner) return;
        if (!getIsFirestoreUsable() || !analyticsDb) {
          return sock.sendMessage(from, { text: '📊 *Bot Statistics (Local Memory Mode)* 📊\n\nDatabase is currently offline. No command analytics are recorded. Bot response time: under 50ms.' }, { quoted: m });
        }
        try {
          const stats = await analyticsDb.get();
          let text = '📊 *Bot Statistics* 📊\n\n';
          stats.forEach(doc => {
            text += `- *${doc.id}*: ${doc.data().usageCount} times\n`;
          });
          await sock.sendMessage(from, { text }, { quoted: m });
        } catch (dbErr: any) {
          await sock.sendMessage(from, { text: 'Error fetching statistics from remote database.' }, { quoted: m });
        }
        break;

      case 'contacts':
        if (!context.isOwner) return;
        if (!getIsFirestoreUsable() || !contactsDb) {
          return sock.sendMessage(from, { text: '📁 *Contacts Storage Offline* 📁\n\nDatabase is down. Automated contacts saving is disabled to ensure zero local connection lag.' }, { quoted: m });
        }
        try {
          const contacts = await contactsDb.get();
          let contactList = '📁 *Saved Contacts:* 📁\n\n';
          contacts.forEach(doc => {
            const data = doc.data();
            contactList += `- ${data.name} (${doc.id})\n`;
          });
          await sock.sendMessage(from, { text: contactList }, { quoted: m });
        } catch (dbErr: any) {
          await sock.sendMessage(from, { text: 'Error querying contacts storage.' }, { quoted: m });
        }
        break;

      default:
        // Unknown command
        break;
    }
  } catch (cmdError: any) {
    console.error(`Error in command processor for command [${command}]:`, cmdError.message || cmdError);
    try {
      await sock.sendMessage(from, { text: '⚠️ *System Alert:* An internal system timeout or error occurred. Your command request could not be processed. Please try again.' }, { quoted: m });
    } catch (e) {}
  }
};
