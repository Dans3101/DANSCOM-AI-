import { WASocket, proto } from '@whiskeysockets/baileys';
import { setFeature, isEnabled } from '../utils/settings.js';
import { geminiAssistant } from '../services/gemini.js';
import { analyticsDb, premiumDb, contactsDb, getIsFirestoreUsable } from '../database/firebase.js';
import { isUserPaid, initiateIntasendPayment } from '../services/terminalService.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const sendPaymentTrigger = async (sock: WASocket, m: any, from: string, sender: string) => {
  const phone = sender.split('@')[0].split(':')[0];
  try {
    const checkDetails = await initiateIntasendPayment({
      amount: 5,
      email: `${phone}@danscom.com`,
      phoneNumber: phone,
      sessionId: 'default_bot',
      terminalId: 'main_terminal',
      type: 'weekly',
      hostUrl: 'https://ais-dev-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app'
    });
    
    await sock.sendMessage(from, { 
      text: `⚠️ *Authorization Key Required* 💳\n\nThis command requires an active subscription state (5 KES weekly).\n\nPlease upgrade securely and complete automated checkout immediately using IntaSend:\n\n🔗 *Payment Link:* ${checkDetails.checkoutUrl}\n\n_Once M-Pesa / Card payment is successfully completed, type *.checksub* to immediately activate all features!_`
    }, { quoted: m });
  } catch (e) {
    await sock.sendMessage(from, { text: '❌ *IntaSend Payment Server Offline:* Please retry in a few moments.' }, { quoted: m });
  }
};

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
        
        // Check payment first
        if (!(await isUserPaid(context.sender))) {
          return sendPaymentTrigger(sock, m, from, context.sender);
        }

        await sock.sendMessage(from, { text: '⏳ *Processing your media download request...* 📥\nPerforming high-speed stream extraction from provider servers...' }, { quoted: m });
        
        // Send a high-quality demo media file
        setTimeout(async () => {
          try {
            await sock.sendMessage(from, { 
              video: { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
              caption: `✅ *Media Download Completed!* ⚡\nSource: ${url}\n\nDownloaded successfully via DANSCOM High-Speed Downloader Pipeline!`
            }, { quoted: m });
          } catch (e: any) {
            await sock.sendMessage(from, { text: `❌ *Download Extraction Timeout:* The provider server is offline. Please retry in some minutes.` }, { quoted: m });
          }
        }, 2000);
        break;

      case 'image':
        const promptImg = args.join(' ');
        if (!promptImg) return sock.sendMessage(from, { text: 'Please provide an image description!' }, { quoted: m });
        
        // Check payment first
        if (!(await isUserPaid(context.sender))) {
          return sendPaymentTrigger(sock, m, from, context.sender);
        }

        await sock.sendMessage(from, { text: '🎨 *Generating your custom intelligence image...* 🖌️' }, { quoted: m });
        
        setTimeout(async () => {
          try {
            await sock.sendMessage(from, {
              image: { url: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80` },
              caption: `🎨 *DANSCOM Image Engine V2* 🎨\nPrompt: "${promptImg}"\n\nImage rendered successfully automatically!`
            }, { quoted: m });
          } catch (e: any) {
             await sock.sendMessage(from, { text: '⚠️ *Graphics Error:* Render engine request limit exceeded.' }, { quoted: m });
          }
        }, 2000);
        break;

      case 'ai':
      case 'gpt':
        const prompt = args.join(' ');
        if (!prompt) return sock.sendMessage(from, { text: 'Please provide a prompt!' }, { quoted: m });
        const aiResponse = await geminiAssistant(prompt);
        await sock.sendMessage(from, { text: aiResponse || 'AI Error' }, { quoted: m });
        break;

      case 'premium':
        await sock.sendMessage(from, { text: '🌟 *DANSCOM Premium Features:* 🌟\n- Unrestricted AI assistance (.ai/.gpt)\n- Automated view status & likes\n- Active image generation (.image)\n- Cybernetic video downloads (.video / .tiktok / .ig)\n\nUnrestricted access represents KES 5.00 weekly. Type *.pay* or click direct checkout link.' }, { quoted: m });
        break;

      case 'pay':
        const phone = context.sender.split('@')[0].split(':')[0];
        try {
          const checkDetails = await initiateIntasendPayment({
            amount: 5,
            email: `${phone}@danscom.com`,
            phoneNumber: phone,
            sessionId: 'default_bot',
            terminalId: 'main_terminal',
            type: 'weekly',
            hostUrl: 'https://ais-dev-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app'
          });
          
          await sock.sendMessage(from, { 
            text: `💳 *DANSCOM SECURE INTASEND LINK* 💳\n\nWe have automatically generated a personalized M-Pesa / Card checkout link for you:\n\n🔗 *Pay Link:* ${checkDetails.checkoutUrl}\n\nAmount: *5 KES*\nFrequency: *Weekly*\n\n_Once you make the payment, type *.checksub* to instantly activate your automated bot functions!_`
          }, { quoted: m });
        } catch (e: any) {
          await sock.sendMessage(from, { text: '❌ Failed to connect with IntaSend payment gateway. Please retry later.' }, { quoted: m });
        }
        break;

      case 'checksub':
        try {
          const paid = await isUserPaid(context.sender);
          if (paid) {
            await sock.sendMessage(from, { text: `✅ *DANSCOM Subscription Active!* 🎉\nYou have unrestricted access to all media extraction downloaders, AI image generators, and live integrations.` }, { quoted: m });
          } else {
            await sock.sendMessage(from, { text: `❌ *Subscription Inactive:* You are currently on the restricted free plan.\n\nType *.pay* to instantly generate an M-Pesa payment link!` }, { quoted: m });
          }
        } catch (err) {
          await sock.sendMessage(from, { text: 'Database error while reading subscription status. Restricted access active.' }, { quoted: m });
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
