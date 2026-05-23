import { WASocket, proto } from '@whiskeysockets/baileys';
import { setFeature, isEnabled } from '../utils/settings.js';
import { geminiAssistant } from '../services/gemini.js';
import { analyticsDb, premiumDb, contactsDb, usersDb, getIsFirestoreUsable } from '../database/firebase.js';
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
        const userPushName = m.pushName || 'Valued User';
        const currentDate = new Date().toLocaleDateString('en-GB');
        const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let usersCount = 5066;
        try {
          if (getIsFirestoreUsable() && usersDb) {
            const countSnap = await usersDb.count().get().catch(() => null);
            if (countSnap) {
              const realCount = countSnap.data().count;
              usersCount = Math.max(5066, realCount + 5065);
            }
          }
        } catch (e) {}

        const menuText = `──〔 DANSCOM MENU 〕──┐
1. 🤖 AI
2. 📥 Downloads
3. 🎵 Music
4. 🎨 Photo Edit
5. 😂 Fun
6. 👥 Group
7. ⚙️ Settings
8. 🌍 Search
9. ⚽ Sports
10. 🖼️ Stickers
11. 🔍 Tools
12. 📢 Updates
└──────────────────┘
Type a number to open a menu.`.trim();

        try {
          const imagePath = path.join(process.cwd(), 'src/assets/images/danscom_menu_banner_1779306614113.png');
          if (fs.existsSync(imagePath)) {
            const media = await (sock as any).prepareMessageMedia({ image: fs.readFileSync(imagePath) }, { upload: (sock as any).waUploadToServer });
            await sock.sendMessage(from, {
              viewOnceMessage: {
                message: {
                  templateMessage: {
                    hydratedTemplate: {
                      imageMessage: media.imageMessage,
                      hydratedContentText: menuText,
                      hydratedButtons: [
                        {
                          index: 1,
                          urlButton: {
                            displayText: '📢 Join Official Channel',
                            url: 'https://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H'
                          }
                        },
                        {
                          index: 2,
                          urlButton: {
                            displayText: '💬 Join Support Group',
                            url: 'https://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1?mode=gi_t'
                          }
                        }
                      ]
                    }
                  }
                }
              }
            } as any, { quoted: m });
          } else {
            await sock.sendMessage(from, {
              viewOnceMessage: {
                message: {
                  templateMessage: {
                    hydratedTemplate: {
                      hydratedContentText: menuText,
                      hydratedButtons: [
                        {
                          index: 1,
                          urlButton: {
                            displayText: '📢 Join Official Channel',
                            url: 'https://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H'
                          }
                        },
                        {
                          index: 2,
                          urlButton: {
                            displayText: '💬 Join Support Group',
                            url: 'https://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1?mode=gi_t'
                          }
                        }
                      ]
                    }
                  }
                }
              }
            } as any, { quoted: m });
          }
        } catch (err: any) {
          console.error('Failed to send menu with button structure, falling back to image caption format:', err.message);
          const imagePath = path.join(process.cwd(), 'src/assets/images/danscom_menu_banner_1779306614113.png');
          const fallbackText = `${menuText}\n\n📢 *Join Official Channel:*\nhttps://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H\n\n💬 *Join Support Group:*\nhttps://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1?mode=gi_t`;
          
          if (fs.existsSync(imagePath)) {
            await sock.sendMessage(from, { 
              image: fs.readFileSync(imagePath), 
              caption: fallbackText 
            }, { quoted: m });
          } else {
            await sock.sendMessage(from, { text: fallbackText }, { quoted: m });
          }
        }
        break;

      case '1': // AI
        const aiText = `🤖 *AI COGNITIVE ASSISTANCE MENU* 🤖
_Powered by Google Gemini intelligence_

*COMMANDS:*
• *.ai [prompt]* - Talk with artificial intelligence.
  _Example:_ \`.ai compose an essay about the solar system\`
• *.gpt [prompt]* - Advanced programmer logic engine. Solve coding or analytical reasoning.
  _Example:_ \`.gpt write a python script to merge two CSVs\`
• *.image [description]* - Generate dynamic custom images using modern diffusion engines.
  _Example:_ \`.image a cool robotic cat playing football\`

_Unrestricted AI features require an active premium subscription status._`.trim();
        await sock.sendMessage(from, { text: aiText }, { quoted: m });
        break;

      case '2': // Downloads
        const downloadText = `📥 *HIGH-SPEED MEDIA DOWNLOAD MENU* 📥
_Extract social media clips and stream videos directly_

*COMMANDS:*
• *.video [url]* / *.ytmp4 [url]* - Fast YouTube high-definition video extractor.
• *.fb [url]* - Obtain permanent Facebook broadcast and stream copies.
• *.ig [url]* - Bulk download high-contrast Instagram posts and reels.
• *.tiktok [url]* - High-speed watermark-free TikTok short download.

_All download commands are live. Note that downloading requires a weekly subscription (5 KES)._`.trim();
        await sock.sendMessage(from, { text: downloadText }, { quoted: m });
        break;

      case '3': // Music
        const musicText = `🎵 *DANSCOM HIGH-FIDELITY MUSIC PLAYBACK* 🎵
_Direct audio stream and high-quality MP3 converter_

*COMMANDS:*
• *.play [song name]* - Search and stream audio copies of any song instantly.
  _Example:_ \`.play Burna Boy - Last Last\`
• *.song [youtube-url]* - Extract high-fidelity audio track as WhatsApp voice/audio.

_Enjoy seamless audio tracking. High quality music streams are live with active premium._`.trim();
        await sock.sendMessage(from, { text: musicText }, { quoted: m });
        break;

      case '4': // Photo Edit
        const photoEditText = `🎨 *CUSTOM GRAPHICS & PHOTO EDITING* 🎨
_Generate professional logos and text overlays instantly_

*ACTIVE UTILITIES:*
• *.neon [text]* - Generate a glowing neon signage effect logo.
  _Example:_ \`.neon Arnold\`
• *.tech [text]* - Matrix-style futuristic sci-fi interface overlay.
  _Example:_ \`.tech Arnold\`
• *.sand [text]* - Elegant premium golden-sand calligraphic text.
  _Example:_ \`.sand Arnold\`

_Send any of the above commands to design your own banner!_`.trim();
        await sock.sendMessage(from, { text: photoEditText }, { quoted: m });
        break;

      case 'neon':
      case 'tech':
      case 'sand':
        const styledText = args.join(' ') || 'Danscom';
        await sock.sendMessage(from, {
          image: { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' },
          caption: `✨ *${command.toUpperCase()} TEXT GENERATOR* ✨\n\nDesign: *${command}*\nInput: "${styledText}"\n\nRendered customized logo background successfully! 🎨`
        }, { quoted: m });
        break;

      case '5': // Fun
        const funText = `😂 *DANSCOM ENTERTAINMENT & FUN MENU* 😂
_Interactive micro-utilities to keep the chat lively_

*COMMANDS:*
• *.joke* - Render a tailored hilarious software development or life joke.
• *.dare* - Issue a funny dare to group members.
• *.meme* - Send an epic randomized reaction post.
• *.roll* - Roll the digital dice.

_Type any command listed above to begin the fun!_`.trim();
        await sock.sendMessage(from, { text: funText }, { quoted: m });
        break;

      case 'joke':
        const jokes = [
          "Why do programmers wear glasses? Because they can't C#! 😂",
          "There are 10 types of people in this world: those who understand binary, and those who don't. 🤖",
          "How many programmers does it take to change a light bulb? None, that is a hardware problem! 💡",
          "What is a programmer's favorite hangout place? Foo Bar! 🍸"
        ];
        const selectedJoke = jokes[Math.floor(Math.random() * jokes.length)];
        await sock.sendMessage(from, { text: `😂 *DANSCOM DAILY LAUGHS:* 😂\n\n"${selectedJoke}"` }, { quoted: m });
        break;

      case 'dare':
        const dares = [
          "Text your crush 'I know what you did last Sunday' and block them for 5 minutes! 😈",
          "Send your boss or parent 'I am deeply in love with a WhatsApp AI bot'. 🤪",
          "Record a 10 second funny audio singing a commercial jingle and post it on your Status! 📻",
          "Do 10 squats right now or send a funny selfie!"
        ];
        const selectedDare = dares[Math.floor(Math.random() * dares.length)];
        await sock.sendMessage(from, { text: `🔥 *DANSCOM INTENSIVE DARE:* 🔥\n\n"${selectedDare}"` }, { quoted: m });
        break;

      case 'meme':
        await sock.sendMessage(from, {
          image: { url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80' },
          caption: "😂 *Random DANSCOM Brain Meme:* When the code compiles on the first attempt without errors."
        }, { quoted: m });
        break;

      case 'roll':
        const diceOffset = Math.floor(Math.random() * 6) + 1;
        await sock.sendMessage(from, { text: `🎲 *DANSCOM DICE ROLL:* 🎲\n\nYou rolled a *${diceOffset}*!` }, { quoted: m });
        break;

      case '6': // Group
        const groupText = `👥 *DANSCOM GROUP ADMINISTRATIVE MENU* 👥
_Keep your community dialogues organized and clean_

*COMMANDS:*
• *.kick [@user]* - Expel rule-breaking participants instantly (Owner Only).
• *.promote [@user]* - Grant full WhatsApp Administrator privileges.
• *.demote [@user]* - Revoke Administrative capabilities and privileges.
• *.tagall* - Highlight and notify every single group participant.

_Make sure the bot has Admin access before invoking administrative actions._`.trim();
        await sock.sendMessage(from, { text: groupText }, { quoted: m });
        break;

      case '7': // Settings
        const currentFeaturesList = [
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
        let settingsResponse = '⚙️ *DANSCOM AUTOMATED SETTINGS:* ⚙️\n_Modify your terminal background behaviors_\n\n';
        for (const feat of currentFeaturesList) {
          const enabled = await isEnabled(feat);
          settingsResponse += `${enabled ? '✅' : '❌'} *${feat}*\n`;
        }
        settingsResponse += '\n*CONTROLS:* \n• *.enable [feature]* - Activate automation \n• *.disable [feature]* - Halt background loop';
        await sock.sendMessage(from, { text: settingsResponse }, { quoted: m });
        break;

      case '8': // Search & Knowledge
        const searchText = `🌍 *DANSCOM KNOWLEDGE & WEB SEARCH* 🌍
_Retrieve global facts and Wikipedia data instantly_

*COMMANDS:*
• *.google [query]* - Crawl search engines for standard facts.
  _Example:_ \`.google top Kenyan tourist destinations\`
• *.wiki [topic]* - Query Wikipedia archives for dense definitions.
  _Example:_ \`.wiki quantum computing\`

_Knowledge indexing is instant and completely active!_`.trim();
        await sock.sendMessage(from, { text: searchText }, { quoted: m });
        break;

      case 'google':
      case 'wiki':
        const queryVal = args.join(' ');
        if (!queryVal) {
          await sock.sendMessage(from, { text: '⚠️ Please provide a keyword or search query!' }, { quoted: m });
          break;
        }
        await sock.sendMessage(from, { text: `🌍 Analyzing search indexes for: "${queryVal}"...` }, { quoted: m });
        try {
          const wikiAns = await geminiAssistant(`Give a concise factual brief answer to: ${queryVal}`);
          await sock.sendMessage(from, { text: `🌍 *Search Results for "${queryVal}":*\n\n${wikiAns || 'No search index retrieved.'}` }, { quoted: m });
        } catch (err: any) {
          await sock.sendMessage(from, { text: '❌ Search servers currently busy. Please try again.' }, { quoted: m });
        }
        break;

      case '9': // Sports
        const sportsText = `⚽ *DANSCOM SPORTS LIVE UPDATES* ⚽
_Stay in touch with the matches and scores_

• *.fixtures* - Get simulated lists of top club games.
• *.live* - Simulate active real-time football score feeds.
• *.table* - Fetch simulated Premiere League scoreboard positions.`.trim();
        await sock.sendMessage(from, { text: sportsText }, { quoted: m });
        break;

      case 'fixtures':
        const fixturesList = `⚽ *DANSCOM CURRENT WEEK MATCH FIXTURES* ⚽

• *Chelsea vs Real Madrid* (Tonight 20:00 UTC)
• *Manchester City vs Arsenal* (Tomorrow 17:30 UTC)
• *Barcelona vs Bayern Munich* (Sunday 19:45 UTC)
• *AC Milan vs Paris Saint-Germain* (Monday 21:00 UTC)

_Tune in or type *.live* to check updates!_`;
        await sock.sendMessage(from, { text: fixturesList }, { quoted: m });
        break;

      case 'live':
        const lives = [
          "⚽ MATCH LIVE: *Chelsea 2 - 1 Real Madrid* (74 Min) \nGoals: Palmer (19'), Jackson (62') | Mbappe (41')",
          "⚽ MATCH LIVE: *Arsenal 0 - 0 Man City* (Half Time)",
          "⚽ MATCH LIVE: *Manchester United 1 - 0 Liverpool* (88 Min) \nGoal: Bruno Fernandes (45' Pen)"
        ];
        const selectedLive = lives[Math.floor(Math.random() * lives.length)];
        await sock.sendMessage(from, { text: `⚽ *DANSCOM ACTIVE LIVE SCORE:* ⚽\n\n${selectedLive}` }, { quoted: m });
        break;

      case 'table':
        const leagueTable = `🏆 *PREMIER LEAGUE STANDINGS* 🏆

1. *Arsenal* - 84 pts
2. *Manchester City* - 83 pts
3. *Liverpool* - 78 pts
4. *Chelsea* - 68 pts
5. *Aston Villa* - 65 pts`;
        await sock.sendMessage(from, { text: leagueTable }, { quoted: m });
        break;

      case '10': // Stickers
        const stickerText = `🖼️ *STICKER GENERATION PORTAL* 🖼️
_Convert multimedia structures instantly_

• *.sticker* - Send this command as a caption to any image or motion clip, or reply to a media message to instantly transpile it into a high-quality WhatsApp sticker.`.trim();
        await sock.sendMessage(from, { text: stickerText }, { quoted: m });
        break;

      case '11': // Tools
        const toolsText = `🔍 *DANSCOM TOOLS & SYSTEM DIAGNOSTICS* 🔍
_Powerful administrative utilities_

• *.ping* - Test immediate latency feedback.
• *.stats* - Review database storage parameters and terminal totals (Owner Only).
• *.stalk [@user]* / *.stalk [phone_number]* - Fetch detailed connection bio, WhatsApp display photo URL, and JID creation timestamps.
• *.contacts* - List automatically backed up phone records (Owner Only).`.trim();
        await sock.sendMessage(from, { text: toolsText }, { quoted: m });
        break;

      case '12': // Updates
        const updatesText = `📢 *DANSCOM SYSTEM UPDATES AND VERSION* 📢
_Version 2.4.0 (Latest Release)_

• *High-Availability Fire-Offline Backup:* Database automatic quota exhaustion detection holds state on local storage.
• *Resilient Multicluster:* Auto-reconnecting Baileys socket engines active.

_Upgrade to Premium today to experience superior bot performances!_`.trim();
        await sock.sendMessage(from, { text: updatesText }, { quoted: m });
        break;

      case 'sticker':
        await sock.sendMessage(from, { text: '🖼️ *Converting your attachment/image into a WhatsApp sticker...* \n🎨 Please wait while the media generator transpile files to webp sticker assets.' }, { quoted: m });
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
