import { WASocket, proto } from '@whiskeysockets/baileys';
import { setFeature, isEnabled } from '../utils/settings.js';
import { geminiAssistant } from '../services/gemini.js';
import { analyticsDb, premiumDb, contactsDb } from '../database/firebase.js';
import admin from 'firebase-admin';

export const processCommand = async (
  sock: WASocket, 
  m: any, 
  command: string, 
  args: string[], 
  context: { isOwner: boolean, isGroup: boolean, sender: string }
) => {
  const from = m.key.remoteJid!;
  
  // Track analytics
  if (analyticsDb) {
    await analyticsDb.doc(command).set({
      usageCount: admin.firestore.FieldValue.increment(1),
      lastUsed: admin.firestore.Timestamp.now()
    }, { merge: true });
  }

  switch (command) {
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
      // Placeholder for actual scraper logic
      // In a real app, you would fetch from an API like ailoader.com or similar
      await sock.sendMessage(from, { text: '❌ *Download Error:* This service requires a premium Downloader API key. (Placeholder)' }, { quoted: m });
      break;

    case 'image':
      const promptImg = args.join(' ');
      if (!promptImg) return sock.sendMessage(from, { text: 'Please provide an image description!' }, { quoted: m });
      await sock.sendMessage(from, { text: '🎨 *Generating your image...* 🖌️' }, { quoted: m });
      // Placeholder for image generation (OpenAI/DALL-E)
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
      if (!premiumDb) return sock.sendMessage(from, { text: 'Database unavailable.' }, { quoted: m });
      const subDoc = await premiumDb.doc(context.sender.split(':')[0]).get();
      if (subDoc.exists && subDoc.data()?.expiry.toDate() > new Date()) {
        await sock.sendMessage(from, { text: `You are a premium user! valid until: ${subDoc.data()?.expiry.toDate().toLocaleString()}` }, { quoted: m });
      } else {
        await sock.sendMessage(from, { text: 'You are on the free plan.' }, { quoted: m });
      }
      break;

    case 'stats':
      if (!context.isOwner) return;
      if (!analyticsDb) return sock.sendMessage(from, { text: 'Analytics database unavailable.' }, { quoted: m });
      const stats = await analyticsDb.get();
      let text = '📊 *Bot Statistics* 📊\n\n';
      stats.forEach(doc => {
        text += `- *${doc.id}*: ${doc.data().usageCount} times\n`;
      });
      await sock.sendMessage(from, { text }, { quoted: m });
      break;

    case 'contacts':
      if (!context.isOwner) return;
      if (!contactsDb) return sock.sendMessage(from, { text: 'Contacts database unavailable.' }, { quoted: m });
      const contacts = await contactsDb.get();
      let contactList = '📁 *Saved Contacts:* 📁\n\n';
      contacts.forEach(doc => {
        const data = doc.data();
        contactList += `- ${data.name} (${doc.id})\n`;
      });
      await sock.sendMessage(from, { text: contactList }, { quoted: m });
      break;

    default:
      // Unknown command
      break;
  }
};
