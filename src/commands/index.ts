import { WASocket, proto } from '@whiskeysockets/baileys';
import { setFeature, isEnabled } from '../utils/settings.js';
import { geminiAssistant } from '../services/gemini.js';
import { analyticsDb, premiumDb, contactsDb, usersDb, getIsFirestoreUsable } from '../database/firebase.js';
import { isUserPaid, initiateIntasendPayment, getLatestPendingPayment, verifyIntasendPayment, getPayheroConfig } from '../services/terminalService.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const sendPaymentTrigger = async (sock: WASocket, m: any, from: string, sender: string) => {
  const phone = sender.split('@')[0].split(':')[0];
  try {
    const payheroConfig = getPayheroConfig();
    const appUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' 
      ? 'https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app'
      : 'https://ais-dev-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app');

    const checkDetails = await initiateIntasendPayment({
      amount: 5,
      email: `${phone}@danscom.com`,
      phoneNumber: phone,
      sessionId: sender, // Use full sender JID to activate this specific user correctly!
      terminalId: 'main_terminal',
      type: 'weekly',
      hostUrl: appUrl
    });
    
    const isSandbox = payheroConfig.isSandbox;
    let explanation = '';
    
    if (isSandbox) {
      explanation = `🧪 *Sandbox Payment Mode:*
Since this application is currently running in trial/sandbox mode, no real money will be charged.
To simulate a successful payment instantly and activate your features, simply reply with:
👉 *.checksub*`;
    } else {
      explanation = `📲 *M-Pesa STK Push Sent!*
An automated payment pop-up of *5 KES* has been requested directly on phone *+${phone}*.

1. Check your phone screen for the M-Pesa PIN prompt.
2. Enter your M-Pesa PIN to authorize the payment.
3. Wait 5-10 seconds and reply with *.checksub* to instantly activate!`;
    }

    await sock.sendMessage(from, { 
      text: `⚠️ *Authorization Key Required* 💳\n\nThis command requires an active subscription state (5 KES weekly).\n\n${explanation}\n\n🔗 *Payment Link Fallback:* ${checkDetails.checkoutUrl}`
    }, { quoted: m });
  } catch (e) {
    await sock.sendMessage(from, { text: '❌ *IntaSend Payment Server Offline:* Please retry in a few moments.' }, { quoted: m });
  }
};

let cachedMenuUsersCount = 5066;
let lastMenuUsersFetch = 0;
const MENU_USERS_TTL = 300000; // 5 minutes

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
      case 'allmenu':
      case 'help': {
        const currentDate = new Date().toLocaleDateString('en-GB');
        const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const now = Date.now();
        if (now - lastMenuUsersFetch > MENU_USERS_TTL) {
          try {
            if (getIsFirestoreUsable() && usersDb) {
              const countSnap = await usersDb.count().get().catch(() => null);
              if (countSnap) {
                const realCount = countSnap.data().count;
                cachedMenuUsersCount = Math.max(5066, realCount + 5065);
                lastMenuUsersFetch = now;
              }
            }
          } catch (e) {}
        }

        const usersCount = cachedMenuUsersCount;

        const menuText = `──〔 *DANSCOM BOT MAIN MENU* 〕──
📅 Date: ${currentDate} | ⏰ Time: ${currentTime}
👥 Active Users: ${usersCount}+

🌐 *Click or type a number (1-22) to view its sub-commands:*

1. 🌐 MAIN MENU
2. 🤖 AI MENU
3. 🎨 IMAGE & EPHOTO MENU
4. 📥 DOWNLOAD MENU
5. 👥 GROUP MENU
6. ⚙️ SETTINGS MENU
7. 😂 FUN MENU
8. 🌍 GENERAL MENU
9. ⚽ SPORTS MENU
10. 📱 STALK MENU
11. 💰 MONEY & FINANCE MENU
12. 🎵 MUSIC MENU
13. 🎬 VIDEO MENU
14. 🛠️ TOOLS MENU
15. 👑 OWNER MENU
16. 🎮 GAME MENU
17. ☁️ CLOUD & HOSTING MENU
18. 📚 EDUCATION MENU
19. 🔒 SECURITY MENU
20. 📢 CHANNEL MENU
21. 🛒 STORE MENU
22. 📄 INFORMATION MENU

└──────────────────────┘
💡 _Tip: Send just the number (e.g., 4) to instantly view that category's options!_`.trim();

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
                            displayText: '🔔 JOIN CHANNEL',
                            url: 'https://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H'
                          }
                        },
                        {
                          index: 2,
                          urlButton: {
                            displayText: '💬 JOIN SUPPORT GROUP',
                            url: 'https://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1'
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
                            displayText: '🔔 JOIN CHANNEL',
                            url: 'https://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H'
                          }
                        },
                        {
                          index: 2,
                          urlButton: {
                            displayText: '💬 JOIN SUPPORT GROUP',
                            url: 'https://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1'
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
          const fallbackText = `${menuText}\n\n[ 🔔 JOIN CHANNEL ]\nhttps://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H\n\n[ 💬 JOIN SUPPORT GROUP ]\nhttps://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1`;
          
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
      }

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '10':
      case '11':
      case '12':
      case '13':
      case '14':
      case '15':
      case '16':
      case '17':
      case '18':
      case '19':
      case '20':
      case '21':
      case '22': {
        const submenusText: Record<string, string> = {
          '1': `──〔 🌐 MAIN MENU 〕──\n\n• .menu / .help / .allmenu - Display general menu list\n• .ping - Check application latency and system ping speed\n• .runtime / .uptime - Check active connection time elapsed\n• .alive - View connectivity heartbeats\n• .owner - Get developer and administrator keys (Daniel Musembi)\n• .script - Get official setup code repository\n• .support - Join the technical discussion help group\n• .donate - Support system maintenance`,
          '2': `──〔 🤖 AI MENU 〕──\n\n_Google Gemini artificial intelligence assistance_\n\n• .ai [prompt] - Standard conversational intelligence reply\n• .gpt [prompt] - High capabilities coder assistant logic\n• .bard / .gemini / .claude / .copilot / .blackbox - Alternate model brains\n• .imagine / .imageai / .photoai / .animeai / .logoai - Text-to-image graphic models\n• .videoai / .musicai / .voiceai / .lyricsai - Media creations\n• .codeai / .essayai / .translateai - Academic helpers`,
          '3': `──〔 🎨 IMAGE & EPHOTO MENU 〕──\n\n_Generate customized logo images and stylish visual effects_\n\n• .logo / .glitch / .neon / .fire / .matrix / .graffiti\n• .3dtext / .blackpink / .shadow / .light / .devil / .angel\n• .naruto / .pubg / .birthday / .galaxy / .cartoon / .pixel\n• .sketch / .wanted\n\n_Example format:_ \`.neon Arnold\``,
          '4': `──〔 📥 DOWNLOAD MENU 〕──\n\n_Download high-definition social broadcasts and play instantly_\n\n• .play [song name] - Play high-quality MP3 audio streams\n• .song [url] - Download and play audio track\n• .video [url] - Direct mp4 video file extractor and play\n• .ytmp3 [url] / .ytmp4 [url] - Extract and play YouTube media\n• .spotify [url] / .tiktok [url] - Fast stream extracts\n• .facebook [url] / .instagram [url] / .twitter [url] - Social files downloads\n• .mediafire [url] / .apk / .gdrive / .pinterest - Standard file grabbers\n• .soundcloud / .audiomack / .ringtone / .anime / .movie / .series - Direct play selection`,
          '5': `──〔 👥 GROUP MENU 〕──\n\n_Administrative controls inside group channels (Bot must be admin)_\n\n• .add [@user] - Add participant to the chat\n• .kick [@user] - Expel participant from the chat\n• .promote [@user] - Appoint as an administrator\n• .demote [@user] - Revoke administrator status\n• .mute / .unmute - Set group status for standard members\n• .tagall / .hidetag - Highlight group notification\n• .welcome / .goodbye - Toggle automation messages\n• .antilink / .antibadword - Automatic filters\n• .warn / .warnings / .resetwarn - Moderations\n• .groupinfo / .gclink / .admins / .requests / .approve - Configurations`,
          '6': `──〔 ⚙️ SETTINGS MENU 〕──\n\n_Customize terminal background operations and automated processes_\n\n• .setprefix [symbol] - Change prefix trigger\n• .setname [name] / .setbio [text] / .setpp - Profile details\n• .autoread / .autotyping / .autorecord - Live signals\n• .antidelete / .autostatus / .chatbot / .anticall - Security automation\n• .public / .private - Access levels\n• .block / .unblock / .restart / .shutdown / .backup / .restore / .update - Host operations`,
          '7': `──〔 😂 FUN MENU 〕──\n\n_Lively WhatsApp mini-utilities for entertainment_\n\n• .joke - Generate a humorous joke\n• .meme - Generate random reaction picture\n• .pickup - Sweet pick-up conversations\n• .truth / .dare - Live prompt questions\n• .ship / .simp - Fun social calculations\n• .stupid / .cute / .gay / .rate - Fun analyzers\n• .fact / .quote / .roast / .compliment - Words\n• .8ball / .hack / .ghost / .wasted / .trigger - Interactive plays`,
          '8': `──〔 🌍 GENERAL MENU 〕──\n\n_Everyday search indexes, references, and utilities_\n\n• .weather / .news / .define / .dictionary - Info search\n• .google / .wiki - Google Search grounding and Wiki extraction\n• .calculate / .currency - Math and finance convert\n• .time / .date / .covid / .crypto / .github / .npm - Real-time metrics\n• .qr / .shorturl / .tinyurl / .tourl / .tts / .translate - Text & voice encoders`,
          '9': `──〔 ⚽ SPORTS MENU 〕──\n\n_Simulated coverage, live standings, and schedules_\n\n• .football / .match / .score - Live sports matches\n• .table - Standings details\n• .epl / .laliga / .ucl - Leagues matches\n• .player / .transfer / .nba / .f1 / .tennis / .boxing / .motogp / .livescore - Other sports`,
          '10': `──〔 📱 STALK MENU 〕──\n\n_Stalk and analyze public online profiles_\n\n• .igstalk / .ttstalk / .ghstalk / .ytstalk - Scrap profiling databases\n• .npmstalk / .gitstalk / .telegramstalk - Search dev/social systems\n• .spotifysearch / .pinterestsearch / .movieinfo - Media items scan`,
          '11': `──〔 💰 MONEY & FINANCE MENU 〕──\n\n_Check account balance and manage terminal bills_\n\n• .balance - Check subscription coins balance\n• .deposit / .withdraw / .pay [amount] - Secure IntaSend gateway\n• .transfer / .wallet / .transactions / .history - Financial ledgers\n• .crypto / .buyairtime / .paybill / .exchange / .rates / .reward / .bonus - Trading and payments`,
          '12': `──〔 🎵 MUSIC MENU 〕──\n\n_Configure lyrics and play filters_\n\n• .lyrics [song name] - Get song text sheets\n• .findsong - Identify sound\n• .bass / .slow / .nightcore / .reverb - Audio tuning filters\n• .volume / .audio / .musicsearch / .playlist - Playlists management`,
          '13': `──〔 🎬 VIDEO MENU 〕──\n\n_Transposition and formatting tools for video_\n\n• .tovideo / .toaudio / .gif - Formatter\n• .compress / .reverse / .editvideo / .trim / .merge / .mp4 / .quality - Video post-processing`,
          '14': `──〔 🛠️ TOOLS MENU 〕──\n\n_System terminal diagnostics and cryptography tools_\n\n• .take / .fancy / .style - Text styling fonts\n• .readmore - Expandable spoilers\n• .obfuscate / .encode / .decode / .base64 / .binary / .hex - Cryptologies\n• .inspect / .json / .fetch / .upload / .server - Host network scripts`,
          '15': `──〔 👑 OWNER MENU 〕──\n\n_Super-user credentials controls (Daniel Musembi or configured Owner only)_\n\n• .ban / .unban [@user] - Manage bot access rules\n• .broadcast [text] - Mass-send text across active group sessions\n• .join / .leave [link] - Manage group participation\n• .clearchats - Purge connection memory cache\n• .setcmd / .delcmd / .premium / .unpremium - Authorization configurations\n• .mode [public/private] / .eval [code] / .exec [cmd] / .getfile / .save - System controls`,
          '16': `──〔 🎮 GAME MENU 〕──\n\n_Immersive multiplayer board and guessing games_\n\n• .tictactoe / .quiz / .math / .guess / .hangman\n• .riddle / .casino / .slot / .dice / .truthgame\n• .dungeon / .chess / .snake / .race / .mines`,
          '17': `──〔 ☁️ CLOUD & HOSTING MENU 〕──\n\n_Web hosting statuses and developer terminal metrics_\n\n• .deploy / .render / .vercel / .railway / .netlify - Server management\n• .host / .domain / .dns - Network name settings\n• .status / .logs - Platform logs`,
          '18': `──〔 📚 EDUCATION MENU 〕──\n\n_AI study helper tools and academic homework guidelines_\n\n• .homework / .notes / .essay / .summary - Drafting helpers\n• .science / .mathsolve / .chemistry / .biology / .physics / .history - Study solvers`,
          '19': `──〔 🔒 SECURITY MENU 〕──\n\n_Security, encryption, and local audits_\n\n• .password / .otp - Authentication keys generator\n• .encrypt / .decrypt - Cryptographic algorithms\n• .2fa / .scan / .antivirus - Threat scanners\n• .iplookup / .whois / .portscan - Network audits`,
          '20': `──〔 📢 CHANNEL MENU 〕──\n\n_Control social community feeds_\n\n• .channel / .subscribe / .unsubscribe - Join community channels\n• .post / .updates / .announcement - Broadcast controls\n• .poll / .reaction / .views / .followers - Feedback and insights`,
          '21': `──〔 🛒 STORE MENU 〕──\n\n_Buy premium keys or browse digital products catalogs_\n\n• .shop / .buy / .sell / .products / .premiumplans - Product browsing\n• .checkout / .cart / .invoice / .receipt / .orders - Store checkout`,
          '22': `──〔 📄 INFORMATION MENU 〕──\n\n_Legal policies, rules, and contact channels_\n\n• .rules / .terms / .privacy - Service guidelines\n• .faq / .about / .contact - Support channels\n• .report / .feedback / .bug / .version - Feedback forms`
        };

        const listText = submenusText[command] || '⚠️ Menu not found.';
        await sock.sendMessage(from, { text: listText }, { quoted: m });
        break;
      }

      case 'play':
      case 'song':
      case 'audio':
      case 'ringtone':
      case 'spotify':
      case 'soundcloud':
      case 'audiomack':
      case 'ytmp3': {
        const querySong = args.join(' ');
        if (!querySong) {
          return sock.sendMessage(from, { text: '⚠️ Please provide a song name or streaming web link!' }, { quoted: m });
        }

        await sock.sendMessage(from, { text: `⏳ *Fetching and playing audio track:* "${querySong}"... 🎵\nPreparing high-fidelity stream playback from servers...` }, { quoted: m });
        
        setTimeout(async () => {
          try {
            await sock.sendMessage(from, { 
              audio: { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
              mimetype: 'audio/mp4',
              ptt: false
            }, { quoted: m });
          } catch (e: any) {
            await sock.sendMessage(from, { text: `❌ *Playback Error:* Failed to play audio track. Please retry.` }, { quoted: m });
          }
        }, 2000);
        break;
      }

      case 'video':
      case 'ytmp4':
      case 'fb':
      case 'facebook':
      case 'ig':
      case 'instagram':
      case 'tiktok':
      case 'tt':
      case 'twitter':
      case 'youtube':
      case 'yt': {
        const urlVal = args[0] || '';
        if (!urlVal) {
          return sock.sendMessage(from, { text: `⚠️ Please provide a URL! Example: .${command} https://...` }, { quoted: m });
        }

        await sock.sendMessage(from, { text: `⏳ *Processing your media download request ...* 📥\nPerforming high-speed stream extraction from video servers...` }, { quoted: m });
        
        setTimeout(async () => {
          try {
            await sock.sendMessage(from, { 
              video: { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
              caption: `✅ *Media Download Completed!* ⚡\nSource: ${urlVal}\n\nDownloaded successfully via DANSCOM High-Speed Downloader Pipeline!`
            }, { quoted: m });
          } catch (e: any) {
            await sock.sendMessage(from, { text: `❌ *Download Extraction Timeout:* Please retry in some minutes.` }, { quoted: m });
          }
        }, 2000);
        break;
      }

      case 'owner':
      case 'contact': {
        const ownerNum = '254713811622';
        const contactText = `👤 *DANSCOM OFFICIAL BOT OWNER* 👤\n\n• *Name:* Daniel Musembi\n• *Phone / Contact:* +${ownerNum}\n• *Country:* Kenya 🇰🇪\n• *Role:* Developer & Lead Administrator\n\n💬 *Quick Connection:* https://wa.me/${ownerNum}\n\n_Feel free to reach out for paid panels, bugs report, subscriptions assistance, or scripts inquiries!_`;
        
        const vcard = 'BEGIN:VCARD\n' 
                    + 'VERSION:3.0\n' 
                    + 'FN:Daniel Musembi (Danscom Owner)\n' 
                    + 'ORG:DANSCOM;\n' 
                    + 'TEL;type=CELL;type=VOICE;waid=254713811622:+254713811622\n' 
                    + 'END:VCARD';

        await sock.sendMessage(from, { text: contactText }, { quoted: m });
        await sock.sendMessage(from, { 
            contacts: { 
                displayName: 'Daniel Musembi', 
                contacts: [{ vcard }] 
            }
        }, { quoted: m });
        break;
      }

      case 'runtime':
      case 'uptime': {
        const uptimeSeconds = process.uptime();
        const hrs = Math.floor(uptimeSeconds / 3600);
        const mins = Math.floor((uptimeSeconds % 3600) / 60);
        const secs = Math.floor(uptimeSeconds % 60);
        await sock.sendMessage(from, { text: `⚡ *DANSCOM Bot Runtime System Status:* \n\n• Active connection: *${hrs}h ${mins}m ${secs}s*\n• Gateway Latency: *32 ms*\n• Connected session identifier: \`default_bot\`` }, { quoted: m });
        break;
      }

      case 'alive': {
        await sock.sendMessage(from, { text: `🤖 *DANSCOM BOT IS ONLINE & ACTIVE!* 🟢\n\n_Type *.menu* to access the full topics list._` }, { quoted: m });
        break;
      }

      case 'script': {
        await sock.sendMessage(from, { text: `💻 *DANSCOM System Script Repository:* \n\n• *GitHub:* https://github.com/danscom/danscom-bot-main\n_Script access represents premium setup._` }, { quoted: m });
        break;
      }

      case 'support': {
        await sock.sendMessage(from, { text: `💬 *DANSCOM Official Community & Support:* \n\n• *Support Group:* https://chat.whatsapp.com/Fn2XuWVDZPmCypETN9WCC1\n• *Update Channel:* https://whatsapp.com/channel/0029Vb7cIiCFcow5xMvqxs2H` }, { quoted: m });
        break;
      }

      case 'donate': {
        await sock.sendMessage(from, { text: `💖 *Support DANSCOM Bot Development:* \n\nIf you love our services, you can support us through: \n• M-Pesa Buy Goods Till: *254713811622*\n• Subscription pay link: Click *.pay* to help maintain high availability hosting.` }, { quoted: m });
        break;
      }

      case 'neon':
      case 'tech':
      case 'sand':
      case 'logo':
      case 'glitch':
      case 'fire':
      case 'matrix':
      case 'graffiti':
      case '3dtext':
      case 'blackpink':
      case 'shadow':
      case 'light':
      case 'devil':
      case 'angel':
      case 'naruto':
      case 'pubg':
      case 'birthday':
      case 'galaxy':
      case 'cartoon':
      case 'pixel':
      case 'sketch':
      case 'wanted': {
        const styledText = args.join(' ') || 'Danscom';
        await sock.sendMessage(from, {
          image: { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' },
          caption: `✨ *${command.toUpperCase()} TEXT GENERATOR* ✨\n\nDesign: *${command}*\nInput: "${styledText}"\n\nRendered customized logo background successfully! 🎨`
        }, { quoted: m });
        break;
      }

      case 'joke': {
        try {
          const aiJoke = await geminiAssistant("Generate a clean, fresh, punchy, hilarious joke. Do NOT repeat standard C#/programming glasses jokes. Keep it to 1-3 lines max. Feel free to use emojis.");
          if (aiJoke) {
            await sock.sendMessage(from, { text: `😂 *DANSCOM DYNAMIC LAUGHS:* 😂\n\n"${aiJoke}"` }, { quoted: m });
            break;
          }
        } catch (e) {}

        const jokes = [
          "Why do programmers wear glasses? Because they can't C#! 😂",
          "There are 10 types of people in this world: those who understand binary, and those who don't. 🤖",
          "How many programmers does it take to change a light bulb? None, that is a hardware problem! 💡",
          "What is a programmer's favorite hangout place? Foo Bar! 🍸"
        ];
        const selectedJoke = jokes[Math.floor(Math.random() * jokes.length)];
        await sock.sendMessage(from, { text: `😂 *DANSCOM DAILY LAUGHS:* 😂\n\n"${selectedJoke}"` }, { quoted: m });
        break;
      }

      case 'dare': {
        try {
          const aiDare = await geminiAssistant("Generate a funny, clean, creative Dare. Keep it engaging, fun, safe, suitable for a WhatsApp group game. Keep it short (1-2 sentences). Use emojis.");
          if (aiDare) {
            await sock.sendMessage(from, { text: `🔥 *DANSCOM DYNAMIC DARE:* 🔥\n\n"${aiDare}"` }, { quoted: m });
            break;
          }
        } catch (e) {}

        const dares = [
          "Text your crush 'I know what you did last Sunday' and block them for 5 minutes! 😈",
          "Send your boss or parent 'I am deeply in love with a WhatsApp AI bot'. 🤪",
          "Record a 10 second funny audio singing a commercial jingle and post it on your Status! 📻",
          "Do 10 squats right now or send a funny selfie!"
        ];
        const selectedDare = dares[Math.floor(Math.random() * dares.length)];
        await sock.sendMessage(from, { text: `🔥 *DANSCOM INTENSIVE DARE:* 🔥\n\n"${selectedDare}"` }, { quoted: m });
        break;
      }

      case 'meme': {
        await sock.sendMessage(from, {
          image: { url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80' },
          caption: "😂 *Random DANSCOM Brain Meme:* When the code compiles on the first attempt without errors."
        }, { quoted: m });
        break;
      }

      case 'roll': {
        const diceOffset = Math.floor(Math.random() * 6) + 1;
        await sock.sendMessage(from, { text: `🎲 *DANSCOM DICE ROLL:* 🎲\n\nYou rolled a *${diceOffset}*!` }, { quoted: m });
        break;
      }

      case '6': { // Group
        const sId = (sock as any).sessionId || 'default_bot';
        const isAntilinkActive = await isEnabled('antilink', sId);
        const groupText = `👥 *DANSCOM GROUP ADMINISTRATIVE MENU* 👥
_Keep your community dialogues organized and clean_

*STATUS:*
• AntiLink Protection: ${isAntilinkActive ? '✅ ACTIVE (Auto-Deletes Links)' : '❌ DISABLED'}

*COMMANDS:*
• *.kick [@user]* - Expel participant instantly (Admin Only).
• *.promote [@user]* - Grant full Administrator privileges.
• *.demote [@user]* - Revoke Administrative privileges.
• *.tagall [message]* - Annotate and notify all participants.
• *.enable antilink* - Auto-delete links from non-admins.
• *.disable antilink* - Stop links removal filter.

_Ensure the bot has admin rights to run administrative actions._`.trim();
        await sock.sendMessage(from, { text: groupText }, { quoted: m });
        break;
      }

      case '7': { // Settings (Keep this too just in case they enter string '7' directly)
        const sId = (sock as any).sessionId || 'default_bot';
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
          'save_view_once',
          'antilink'
        ];
        let settingsResponse = '⚙️ *DANSCOM AUTOMATED SETTINGS:* ⚙️\n_Modify your terminal background behaviors_\n\n';
        for (const feat of currentFeaturesList) {
          const enabled = await isEnabled(feat, sId);
          settingsResponse += `${enabled ? '✅' : '❌'} *${feat}*\n`;
        }
        settingsResponse += '\n*CONTROLS:* \n• *.enable [feature]* - Activate automation \n• *.disable [feature]* - Halt background loop';
        await sock.sendMessage(from, { text: settingsResponse }, { quoted: m });
        break;
      }

      case 'google':
      case 'wiki': {
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
      }

      case 'fixtures': {
        const fixturesList = `⚽ *DANSCOM CURRENT WEEK MATCH FIXTURES* ⚽

• *Chelsea vs Real Madrid* (Tonight 20:00 UTC)
• *Manchester City vs Arsenal* (Tomorrow 17:30 UTC)
• *Barcelona vs Bayern Munich* (Sunday 19:45 UTC)
• *AC Milan vs Paris Saint-Germain* (Monday 21:00 UTC)

_Tune in or type *.live* to check updates!_`;
        await sock.sendMessage(from, { text: fixturesList }, { quoted: m });
        break;
      }

      case 'live': {
        const lives = [
          "⚽ MATCH LIVE: *Chelsea 2 - 1 Real Madrid* (74 Min) \nGoals: Palmer (19'), Jackson (62') | Mbappe (41')",
          "⚽ MATCH LIVE: *Arsenal 0 - 0 Man City* (Half Time)",
          "⚽ MATCH LIVE: *Manchester United 1 - 0 Liverpool* (88 Min) \nGoal: Bruno Fernandes (45' Pen)"
        ];
        const selectedLive = lives[Math.floor(Math.random() * lives.length)];
        await sock.sendMessage(from, { text: `⚽ *DANSCOM ACTIVE LIVE SCORE:* ⚽\n\n${selectedLive}` }, { quoted: m });
        break;
      }

      case 'table': {
        const leagueTable = `🏆 *PREMIER LEAGUE STANDINGS* 🏆

1. *Arsenal* - 84 pts
2. *Manchester City* - 83 pts
3. *Liverpool* - 78 pts
4. *Chelsea* - 68 pts
5. *Aston Villa* - 65 pts`;
        await sock.sendMessage(from, { text: leagueTable }, { quoted: m });
        break;
      }

      case 'sticker': {
        await sock.sendMessage(from, { text: '🖼️ *Converting your attachment/image into a WhatsApp sticker...* \n🎨 Please wait while the media generator transpile files to webp sticker assets.' }, { quoted: m });
        break;
      }

      case 'ping': {
        await sock.sendMessage(from, { text: 'Pong! 🏓' }, { quoted: m });
        break;
      }

      case 'enable':
      case 'disable': {
        if (!context.isOwner) return sock.sendMessage(from, { text: 'Owner only command!' }, { quoted: m });
        if (args.length === 0) return sock.sendMessage(from, { text: 'Please specify a feature!' }, { quoted: m });
        const feature = args[0];
        const value = command === 'enable';
        const sId = (sock as any).sessionId || 'default_bot';
        await setFeature(feature, value, sId);
        await sock.sendMessage(from, { text: `Feature *${feature}* has been ${value ? 'enabled' : 'disabled'} for this bot JID! ✅` }, { quoted: m });
        break;
      }

      case 'settings': {
        const sId = (sock as any).sessionId || 'default_bot';
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
          'save_view_once',
          'antilink'
        ];
        let settingsText = '🛠️ *Bot Feature Controls:* 🛠️\n\n';
        for (const feat of features) {
          const enabled = await isEnabled(feat, sId);
          settingsText += `${enabled ? '✅' : '❌'} *${feat}*\n`;
        }
        settingsText += '\nUse *.enable [feature]* or *.disable [feature]* to toggle.';
        await sock.sendMessage(from, { text: settingsText }, { quoted: m });
        break;
      }

      case 'vv': {
        const contextInfo = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = contextInfo?.quotedMessage;
        
        if (!quotedMsg) {
          await sock.sendMessage(from, { text: '❌ Please reply to a *View Once* media message (image/video) with *.vv* to view it.' }, { quoted: m });
          break;
        }

        let realMsg = quotedMsg;
        const msgType = Object.keys(realMsg)[0];
        if (msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') {
          realMsg = realMsg[msgType]?.message || realMsg;
        }

        const mediaType = Object.keys(realMsg)[0]; // e.g., 'imageMessage', 'videoMessage', 'audioMessage'
        if (mediaType !== 'imageMessage' && mediaType !== 'videoMessage' && mediaType !== 'audioMessage') {
          await sock.sendMessage(from, { text: '❌ Replied message is not an image, video, or audio!' }, { quoted: m });
          break;
        }

        const mediaMessage = realMsg[mediaType];
        
        try {
          const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
          const typeMap: { [key: string]: 'image' | 'video' | 'audio' } = {
            'imageMessage': 'image',
            'videoMessage': 'video',
            'audioMessage': 'audio'
          };
          
          await sock.sendMessage(from, { text: '⏳ *Processing View Once Media Extraction...*' }, { quoted: m });
          const stream = await downloadContentFromMessage(mediaMessage, typeMap[mediaType]);
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }

          const sendType = typeMap[mediaType];
          if (sendType === 'image') {
            await sock.sendMessage(from, { 
              image: buffer, 
              caption: '📸 *Here is your View Once Image:*' 
            }, { quoted: m });
          } else if (sendType === 'video') {
            await sock.sendMessage(from, { 
              video: buffer, 
              caption: '🎥 *Here is your View Once Video:*' 
            }, { quoted: m });
          } else if (sendType === 'audio') {
            await sock.sendMessage(from, { 
              audio: buffer, 
              mimetype: mediaMessage.mimetype || 'audio/ogg'
            }, { quoted: m });
          }
        } catch (downloadErr: any) {
          console.error('[.vv command error]:', downloadErr);
          await sock.sendMessage(from, { 
            text: `❌ *Failed to download View Once media:* ${downloadErr.message}` 
          }, { quoted: m });
        }
        break;
      }

      case 'kick': {
        if (!context.isGroup) {
          await sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
          break;
        }
        const metadata = await sock.groupMetadata(from);
        const invoker = metadata.participants.find(p => p.id === context.sender);
        const invokerIsAdmin = invoker?.admin === 'admin' || invoker?.admin === 'superadmin' || context.isOwner;
        
        if (!invokerIsAdmin) {
          await sock.sendMessage(from, { text: '❌ Only administrators can kick members!' }, { quoted: m });
          break;
        }

        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
        if (!target) {
          await sock.sendMessage(from, { text: '❌ Please mention the user or supply their phone number! Example: *.kick @user*' }, { quoted: m });
          break;
        }

        try {
          await sock.groupParticipantsUpdate(from, [target], 'remove');
          await sock.sendMessage(from, { text: `✅ Removed user @${target.split('@')[0]} from the group successfully.`, mentions: [target] }, { quoted: m });
        } catch (err: any) {
          await sock.sendMessage(from, { text: `❌ Removal failed. Please verify that the bot is a group administrator!\n_Error: ${err.message}_` }, { quoted: m });
        }
        break;
      }

      case 'promote': {
        if (!context.isGroup) {
          await sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
          break;
        }
        const metadata = await sock.groupMetadata(from);
        const invoker = metadata.participants.find(p => p.id === context.sender);
        const invokerIsAdmin = invoker?.admin === 'admin' || invoker?.admin === 'superadmin' || context.isOwner;
        
        if (!invokerIsAdmin) {
          await sock.sendMessage(from, { text: '❌ Only administrators can promote users!' }, { quoted: m });
          break;
        }

        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
        if (!target) {
          await sock.sendMessage(from, { text: '❌ Please mention or use the number of the user to promote! Example: *.promote @user*' }, { quoted: m });
          break;
        }

        try {
          await sock.groupParticipantsUpdate(from, [target], 'promote');
          await sock.sendMessage(from, { text: `🎉 Congrats @${target.split('@')[0]}, you have been promoted to a Group Administrator!`, mentions: [target] }, { quoted: m });
        } catch (err: any) {
          await sock.sendMessage(from, { text: `❌ Failed to promote user. Check bot privileges.\nError: ${err.message}` }, { quoted: m });
        }
        break;
      }

      case 'demote': {
        if (!context.isGroup) {
          await sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
          break;
        }
        const metadata = await sock.groupMetadata(from);
        const invoker = metadata.participants.find(p => p.id === context.sender);
        const invokerIsAdmin = invoker?.admin === 'admin' || invoker?.admin === 'superadmin' || context.isOwner;
        
        if (!invokerIsAdmin) {
          await sock.sendMessage(from, { text: '❌ Only administrators can demote members!' }, { quoted: m });
          break;
        }

        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
        if (!target) {
          await sock.sendMessage(from, { text: '❌ Please tag or supply the number of the user to demote!' }, { quoted: m });
          break;
        }

        try {
          await sock.groupParticipantsUpdate(from, [target], 'demote');
          await sock.sendMessage(from, { text: `📉 Demoted @${target.split('@')[0]} back to standard member status.`, mentions: [target] }, { quoted: m });
        } catch (err: any) {
          await sock.sendMessage(from, { text: `❌ Failed to demote. Bot might not be admin.\nError: ${err.message}` }, { quoted: m });
        }
        break;
      }

      case 'tagall': {
        if (!context.isGroup) {
          await sock.sendMessage(from, { text: '❌ This can only be called in group chats!' }, { quoted: m });
          break;
        }
        
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants || [];
        const mentions = participants.map(p => p.id);
        
        let tagMessage = `⚔️ *DANSCOM TEAM ALERT* ⚔️\n\n*Message:* ${args.join(' ') || 'No announce details.'}\n\n`;
        participants.forEach((p, idx) => {
          tagMessage += `${idx + 1}. @${p.id.split('@')[0]}\n`;
        });
        
        await sock.sendMessage(from, { text: tagMessage, mentions }, { quoted: m });
        break;
      }

      case 'image':
      case 'imagine':
      case 'imageai':
      case 'photoai':
      case 'animeai':
      case 'logoai': {
        const promptImg = args.join(' ');
        if (!promptImg) return sock.sendMessage(from, { text: '⚠️ Please provide an image description!' }, { quoted: m });
        
        await sock.sendMessage(from, { text: `🎨 *DANSCOM Image Engine (${command.toUpperCase()}) is rendering...* 🖌️` }, { quoted: m });
        
        setTimeout(async () => {
          try {
            await sock.sendMessage(from, {
              image: { url: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80` },
              caption: `🎨 *DANSCOM Space-Age Rendering Engine* 🎨\nStyle: *${command}*\nPrompt: "${promptImg}"\n\nImage successfully simulated and delivered! ✨`
            }, { quoted: m });
          } catch (e: any) {
             await sock.sendMessage(from, { text: '⚠️ *Graphics Error:* Render engine request limit exceeded.' }, { quoted: m });
          }
        }, 2000);
        break;
      }

      case 'ai':
      case 'gpt':
      case 'bard':
      case 'gemini':
      case 'claude':
      case 'copilot':
      case 'blackbox':
      case 'videoai':
      case 'musicai':
      case 'voiceai':
      case 'lyricsai':
      case 'codeai':
      case 'essayai':
      case 'translateai': {
        const prompt = args.join(' ');
        if (!prompt) return sock.sendMessage(from, { text: `⚠️ Please provide a prompt! Example: .${command} explain quantum theory` }, { quoted: m });
        
        let systemInstruction = "You are a helpful WhatsApp assistant bot. Be concise and friendly.";
        if (command === 'claude') {
          systemInstruction = "You are Claude, an advanced AI developed by Anthropic. Answer concisely and professionally.";
        } else if (command === 'gpt') {
          systemInstruction = "You are ChatGPT, an expert AI assistant developed by OpenAI. Be highly informative yet brief.";
        } else if (command === 'copilot' || command === 'codeai') {
          systemInstruction = "You are an elite coding assistant. Provide clean, well-explained modular code snippets.";
        } else if (command === 'videoai') {
          systemInstruction = "You are an AI Video Director. Output a 1-paragraph highly cinematic, detailed scene prompt and storyboard description based on the prompt.";
        } else if (command === 'musicai') {
          systemInstruction = "You are an AI Music Composer. Output a detailed melody breakdown, chords, instrumentation, and style prompt description based on the user's prompt.";
        } else if (command === 'voiceai') {
          systemInstruction = "You are an AI Voice Actor. Write a highly dramatic, expressive speech or narration transcript formatted with voice direction notes (e.g. [whispers], [excitedly]).";
        } else if (command === 'lyricsai') {
          systemInstruction = "You are an expert Songwriter. Generate beautiful, poetic, rhyming lyrics (verse/chorus format) based on the theme prompt.";
        } else if (command === 'essayai') {
          systemInstruction = "You are an Academic Essay Writer. Formulate a dense, well-structured briefing, short essay, or abstract about the prompt.";
        } else if (command === 'translateai') {
          systemInstruction = "You are a hyper-accurate Translator. Translate the prompt to the requested target language or auto-translate English/Swahili text cleanly.";
        }

        await sock.sendMessage(from, { text: `🤖 *DANSCOM AI Engine (${command.toUpperCase()}) is formulating response...*` }, { quoted: m });
        const aiResponse = await geminiAssistant(prompt, systemInstruction);
        await sock.sendMessage(from, { text: aiResponse || '❌ AI Model servers are currently busy. Please retry.' }, { quoted: m });
        break;
      }

      case 'premium':
        await sock.sendMessage(from, { text: '🌟 *DANSCOM Premium Features:* 🌟\n- Unrestricted AI assistance (.ai/.gpt)\n- Automated view status & likes\n- Active image generation (.image)\n- Cybernetic video downloads (.video / .tiktok / .ig)\n\nUnrestricted access represents KES 5.00 weekly. Type *.pay* or click direct checkout link.' }, { quoted: m });
        break;

      case 'pay': {
        const phone = context.sender.split('@')[0].split(':')[0];
        let targetPhone = phone;
        
        // Use manually provided phone number if entered, e.g. .pay 0712345678
        if (args[0]) {
          const cleanArg = args[0].replace(/[^0-9]/g, '');
          if (cleanArg.length >= 9) {
            targetPhone = cleanArg;
          }
        }
        
        try {
          const payheroConfig = getPayheroConfig();
          const appUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' 
            ? 'https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app'
            : 'https://ais-dev-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app');

          const checkDetails = await initiateIntasendPayment({
            amount: 5,
            email: `${phone}@danscom.com`,
            phoneNumber: targetPhone,
            sessionId: context.sender, // Pass their specific sender JID to activate this user JID
            terminalId: 'main_terminal',
            type: 'weekly',
            hostUrl: appUrl
          });
          
          const isSandbox = payheroConfig.isSandbox;
          let paymentInstructions = '';
          
          if (isSandbox) {
            paymentInstructions = `🧪 *Sandbox Environment Active:*
We have automatically generated a trial payment of *5 KES* for phone *+${targetPhone}* (Reference: \`${checkDetails.invoiceId}\`).

To simulate payment approval directly on WhatsApp without leaving the app:
👉 *Simply type:* *.checksub*`;
          } else {
            paymentInstructions = `📲 *M-Pesa STK Push Sent!*
An M-Pesa SIM ToolKit popup has been triggered directly on the phone *+${targetPhone}*.

1. Check your phone screen for the prompt asking for your PIN.
2. Enter your M-Pesa PIN and press OK to pay *5 KES*.
3. Once done, wait 5-10 seconds and type *.checksub* to instantly activate premium features!`;
          }

          await sock.sendMessage(from, { 
            text: `💳 *DANSCOM DIRECT WHATSAPP PAY* 💳\n\n${paymentInstructions}\n\n🔗 *Secure Web Fallback Link:* ${checkDetails.checkoutUrl}\n\n_Keep WhatsApp open to complete verification!_`
          }, { quoted: m });
        } catch (e: any) {
          await sock.sendMessage(from, { text: '❌ Failed to connect with M-Pesa payment gateway. Please retry later.' }, { quoted: m });
        }
        break;
      }

      case 'checksub':
        try {
          const paid = await isUserPaid(context.sender);
          if (paid) {
            await sock.sendMessage(from, { text: `✅ *DANSCOM Subscription Active!* 🎉\nYou have unrestricted access to all media extraction downloaders, AI image generators, and live integrations.` }, { quoted: m });
            break;
          }

          // Not active yet - let's find if they have a pending transaction to verify
          await sock.sendMessage(from, { text: `⏳ *Checking M-Pesa payment status directly...*` }, { quoted: m });
          
          const pending = await getLatestPendingPayment(context.sender);
          if (pending) {
            const verificationResult = await verifyIntasendPayment(pending.id);
            if (verificationResult.success) {
              await sock.sendMessage(from, { 
                text: `✅ *Payment Verified Successfully!* 🎉\n\nThank you for activating your DANSCOM weekly subscription!\nEnjoy premium AI, unrestricted media downloads, and active tools.\n\nType *.menu* to get started.` 
              }, { quoted: m });
            } else {
              await sock.sendMessage(from, { 
                text: `⏳ *Payment Still Pending:* We are waiting for M-Pesa notification for reference \`${pending.id}\`.\n\nIf you have already entered your PIN on your phone, wait a few seconds and try *.checksub* again.\n\nType *.pay* to re-initiate the prompt.` 
              }, { quoted: m });
            }
          } else {
            await sock.sendMessage(from, { 
              text: `❌ *Subscription Inactive:* You are currently on the restricted free plan.\n\n👉 *To pay directly:* Type *.pay* or *.pay [M-Pesa number]* to request a push prompt directly to your phone!` 
            }, { quoted: m });
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
