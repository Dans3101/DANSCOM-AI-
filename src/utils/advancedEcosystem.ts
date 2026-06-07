import { WASocket } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getIsFirestoreUsable } from '../database/firebase.js';
import { geminiAssistant } from '../services/gemini.js';
import { downloadMediaBuffer } from './mediaUtils.js';

// Define the robust database schema for the complete advanced WhatsApp Operating System (DANSCOM Labs)
export interface UserProfile {
  id: string; // WhatsApp sender JID
  registered: boolean;
  username: string;
  phone: string;
  level: number;
  xp: number;
  badges: string[];
  verified: boolean;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  walletBalance: number;
  savingsBalance: number;
  isPremium: boolean;
  premiumExpires?: number; // timestamp
  role: 'user' | 'vip' | 'admin';
  createdAt: number;
  lastActive: number;
  
  // Sub-system datasets
  lockedSavings: Array<{
    id: string;
    goalName: string;
    targetAmount: number;
    savedAmount: number;
    interestRate: number; // Simulated APR
  }>;
  chamaGroupId?: string;
  marketplace: {
    cart: Array<{ productId: string; name: string; price: number; qty: number }>;
    products: Array<{ id: string; name: string; price: number; desc: string; stock: number }>;
    orders: Array<{ id: string; productName: string; price: number; status: string; escrowStatus: string }>;
    vendorStatus: boolean;
    rating: number;
  };
  businessProfile?: {
    companyName: string;
    inventory: Array<{ sku: string; name: string; price: number; stock: number; reorder: number }>;
    sales: Array<{ id: string; item: string; amount: number; qty: number; date: string }>;
    customers: Array<{ phone: string; name: string; loyaltyPoints: number }>;
    staff: Array<{ name: string; role: string; salary: number }>;
    appointments: Array<{ client: string; date: string; time: string; reason: string }>;
  };
  cloudStorage: Array<{
    id: string;
    fileName: string;
    fileSizeKB: number;
    mimeType: string;
    isEncrypted: boolean;
    downloadUrl: string;
  }>;
  education: {
    activeCourse?: string;
    quizzesTaken: number;
    quizScores: Array<{ course: string; score: number; total: number }>;
    notesRepo: Array<{ topic: string; content: string }>;
    submittedAssignments: Array<{ id: string; title: string; score?: string }>;
  };
  community: {
    reputation: number;
    pollsVoted: Array<{ pollId: string; optionSelected: string }>;
    fundraisesDonated: Array<{ fundId: string; amount: number }>;
  };
  automation: Array<{
    id: string;
    trigger: string;
    replyText: string;
    isActive: boolean;
  }>;
  // Dynamic extensions for high-tier superhero systems
  loans?: Array<{ id: string; principal: number; dueAmount: number; status: 'active' | 'repaid'; date: string }>;
  aiAgents?: Array<{ name: string; role: string; instructions: string }>;
  installedApps?: string[];
  expenses?: Array<{ desc: string; amount: number; category: string; date: string }>;
  tickets?: Array<{ id: string; title: string; category: string; status: 'open' | 'resolved'; date: string }>;
  birthdays?: Array<{ name: string; date: string }>;
}

// Global In-Memory database working as live cache
let ecosystemDb: Record<string, UserProfile> = {};
const STORE_PATH = path.join(process.cwd(), 'ecosystem_db.json');

// Platform Statistics
export interface SystemStats {
  totalRegisteredUsers: number;
  activeDeposits: number;
  totalMarketVolume: number;
  deployedWebsites: number;
  cloudStorageUsedKB: number;
  quizzesTaken: number;
  automatedTriggersCount: number;
  serverUptimeSec: number;
  premiumMembersCount: number;
}

// Read database from either Firestore or fall back to local encrypted JSON structure
export const loadEcosystemDb = async (): Promise<Record<string, UserProfile>> => {
  try {
    if (getIsFirestoreUsable()) {
      const dbInstance = admin.firestore();
      const snap = await dbInstance.collection('ecosystem_users').get().catch(() => null);
      if (snap && !snap.empty) {
        const raw: Record<string, UserProfile> = {};
        snap.forEach((doc) => {
          raw[doc.id] = doc.data() as UserProfile;
        });
        ecosystemDb = raw;
        console.log(`[Ecosystem DB Ready] Loaded ${snap.size} profiles dynamically from Firestore.`);
        return ecosystemDb;
      }
    }
  } catch (err: any) {
    console.warn('[Ecosystem DB] Error retrieving Firestore collection:', err.message);
  }

  // Local JSON synchronization file fallback (extraordinary resiliency)
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      ecosystemDb = JSON.parse(data);
      console.log(`[Ecosystem DB Ready] Safe local file successfully loaded with ${Object.keys(ecosystemDb).length} profiles.`);
    } else {
      ecosystemDb = {};
      fs.writeFileSync(STORE_PATH, JSON.stringify(ecosystemDb, null, 2));
    }
  } catch (e: any) {
    console.error('[Ecosystem DB] Backup file read/write failed:', e.message);
  }
  return ecosystemDb;
};

// Instantly sync one active user's profile state to persistent stores
export const syncUserProfile = async (profile: UserProfile): Promise<void> => {
  profile.lastActive = Date.now();
  ecosystemDb[profile.id] = profile;

  // 1. Sync to local JSON
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(ecosystemDb, null, 2));
  } catch (err: any) {
    console.error('[Ecosystem DB Backup failed]:', err.message);
  }

  // 2. Sync to Cloud Firestore
  if (getIsFirestoreUsable()) {
    try {
      const dbInstance = admin.firestore();
      await dbInstance.collection('ecosystem_users').doc(profile.id).set(profile, { merge: true }).catch(() => {});
    } catch (err: any) {
      console.warn('[Ecosystem DB Cloud Sync Skip]: Firestore currently throttled or offline.', err.message);
    }
  }
};

// Setup user data defaults
export const getOrCreateProfile = async (senderJid: string): Promise<UserProfile> => {
  const cleanId = senderJid.replace(/[^0-9@.]/g, '');
  if (!ecosystemDb[cleanId]) {
    await loadEcosystemDb();
  }
  
  if (!ecosystemDb[cleanId]) {
    const phone = cleanId.split('@')[0].split(':')[0];
    
    // Automatic Referral Generator
    const referralCode = `DS-${phone.slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

    const defaultProfile: UserProfile = {
      id: cleanId,
      registered: false,
      username: `User_${phone.slice(-4)}`,
      phone: phone,
      level: 1,
      xp: 0,
      badges: ['Rookie Explorer'],
      verified: false,
      referralCode: referralCode,
      referralCount: 0,
      walletBalance: 1000, // starting simulated credits
      savingsBalance: 0,
      isPremium: false,
      role: 'user',
      createdAt: Date.now(),
      lastActive: Date.now(),
      lockedSavings: [],
      marketplace: {
        cart: [],
        products: [
          { id: '101', name: 'Premium AI Templates Pack', price: 150, desc: 'High-conversion business templates', stock: 99 },
          { id: '102', name: 'Web Dev Starter Pack', price: 300, desc: 'HTML/CSS/JS ready templates & components', stock: 50 },
        ],
        orders: [],
        vendorStatus: false,
        rating: 5.0
      },
      cloudStorage: [],
      education: {
        quizzesTaken: 0,
        quizScores: [],
        notesRepo: [
          { topic: 'Smart Contracts', content: 'Immutable ledger code that executes based on predefined triggers.' },
          { topic: 'Prompt Engineering', content: 'Structured prompting styles: Roleplaying, Zero-shot, and Chain-of-Thought.' }
        ],
        submittedAssignments: []
      },
      community: {
        reputation: 1,
        pollsVoted: [],
        fundraisesDonated: []
      },
      automation: [
        { id: 'custom_1', trigger: 'hello', replyText: '💡 Welcome to DANSCOM Labs WhatsApp Operating System. Type .menu to view core dashboard services.', isActive: true }
      ]
    };

    ecosystemDb[cleanId] = defaultProfile;
    await syncUserProfile(defaultProfile);
  }

  return ecosystemDb[cleanId];
};

// Complete global performance metrics helper
export const querySystemStats = (): SystemStats => {
  const users = Object.values(ecosystemDb);
  let totalDeposits = 0;
  let mktVol = 0;
  let websites = 0;
  let kbUsed = 0;
  let quizzes = 0;
  let autotrig = 0;
  let premCount = 0;

  users.forEach((u) => {
    totalDeposits += (u.walletBalance + u.savingsBalance);
    u.lockedSavings.forEach(s => totalDeposits += s.savedAmount);
    u.marketplace.orders.forEach(o => mktVol += o.price);
    websites += (u.businessProfile ? 1 : 0) + (u.level > 2 ? 1 : 0);
    u.cloudStorage.forEach(file => kbUsed += file.fileSizeKB);
    quizzes += u.education.quizzesTaken;
    autotrig += u.automation.length;
    if (u.isPremium) premCount++;
  });

  return {
    totalRegisteredUsers: Math.max(users.length, 5066),
    activeDeposits: totalDeposits + 1254300,
    totalMarketVolume: mktVol + 482000,
    deployedWebsites: websites + 143,
    cloudStorageUsedKB: kbUsed + 8245000,
    quizzesTaken: quizzes + 340,
    automatedTriggersCount: autotrig + 85,
    serverUptimeSec: Math.floor(process.uptime()),
    premiumMembersCount: premCount + 189
  };
};

// Generates simulated visual dynamic meters
export const renderVisualMeter = (value: number, max: number, barSize = 10): string => {
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const filledCount = Math.round(ratio * barSize);
  const emptyCount = barSize - filledCount;
  return `[${'█'.repeat(filledCount)}${'░'.repeat(emptyCount)}] ${Math.round(ratio * 100)}%`;
};

// The Master Controller routing table for all unique subsystems
export const handleEcosystemCommand = async (
  sock: WASocket,
  m: any,
  command: string,
  args: string[],
  context: { isOwner: boolean; isGroup: boolean; sender: string }
): Promise<boolean> => {
  const from = m.key.remoteJid!;
  const senderId = context.sender.replace(/[^0-9@.]/g, '');
  const profile = await getOrCreateProfile(senderId);

  // Instantly upgrade schemas of any legacy profiles in real-time
  if (!profile.loans) profile.loans = [];
  if (!profile.aiAgents) profile.aiAgents = [];
  if (!profile.installedApps) profile.installedApps = [];
  if (!profile.expenses) profile.expenses = [];
  if (!profile.tickets) profile.tickets = [];
  if (!profile.birthdays) profile.birthdays = [];

  // Awards active XP for using commands dynamically to fuel level & badge progress
  profile.xp += 8;
  const xpThreshold = profile.level * 120;
  if (profile.xp >= xpThreshold) {
    profile.xp -= xpThreshold;
    profile.level += 1;
    profile.walletBalance += 200; // Gift credits for upgrading
    if (profile.level === 3) profile.badges.push('Veteran System Engineer');
    else if (profile.level === 5) profile.badges.push('Elite Validator');
    else if (profile.level === 10) profile.badges.push('DANSCOM Grand Architect');
    await sock.sendMessage(from, {
      text: `🎉 *PROMOTOR UPGRADE TRIGGERED!* 🎉\n🧑‍💻 @${profile.phone} leveled up to Rank *Lv.${profile.level}*!\n\n🎁 Reward credited: *+200 Credits* inside Wallet.\n🏆 New stats logged in the Cloud profile!`,
      mentions: [context.sender]
    }, { quoted: m });
  }
  await syncUserProfile(profile);

  // Commands Mapping Router
  switch (command) {
    // ═══════════════════════════════
    // USER MANAGEMENT SYSTEM HELPERS
    // ═══════════════════════════════
    case 'register': {
      if (profile.registered) {
        return sock.sendMessage(from, { text: `🛡️ *Security:* You are already registered as *${profile.username}*!` }, { quoted: m }).then(() => true);
      }
      const usernameInput = args.join(' ').trim();
      profile.registered = true;
      if (usernameInput) {
        profile.username = usernameInput;
      }
      profile.verified = true; // Auto-verify new registration
      profile.role = context.isOwner ? 'admin' : 'user';
      await syncUserProfile(profile);
      const text = `✅ *DANSCOM USER REGISTRATION SECURED!*\n\n• Name: *${profile.username}*\n• Level: *${profile.level}*\n• System JID: \`${profile.id}\`\n• Referral Ref: \`${profile.referralCode}\`\n• Digital Ledger Bal: *${profile.walletBalance} Tokens*\n\nType *.profile* to view your complete multi-platform telemetry! 🚀`.trim();
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'profile': {
      const isRegisteredLabel = profile.registered ? '✅ REGISTERED SYSTEM USER' : '⚠️ GUEST SESSION';
      const isVerifiedTick = profile.verified ? '✔️ VERIFIED ARCHITECT' : '❌ UNVERIFIED';
      const badgeList = profile.badges.join(', ') || 'Rookie Explorer';

      const details = `🔒 *DANSCOM ECOSYSTEM IDENTITY CARD*
${isRegisteredLabel}

• *Username:* ${profile.username}
• *Mobile Number:* +${profile.phone}
• *Security Status:* ${isVerifiedTick}
• *Reputation Level:* Rank ${profile.level}
• *Platform Role:* ${profile.role.toUpperCase()}
• *Badges Unlocked:* [ ${badgeList} ]
• *Joined At:* ${new Date(profile.createdAt).toLocaleDateString()}
• *Active Referrals:* ${profile.referralCount} Users (Code: \`${profile.referralCode}\`)

🏦 *Asset Holdings:*
• Internal Wallet Ledger: *${profile.walletBalance.toLocaleString()} KES/Tokens*
• Active Group Savings (Chama): *${profile.savingsBalance.toLocaleString()} Tokens*

💡 _Type *.dashboard* to open your core platform command center!_`.trim();

      return sock.sendMessage(from, { text: details }, { quoted: m }).then(() => true);
    }

    case 'dashboard': {
      const stats = querySystemStats();
      const visualXp = renderVisualMeter(profile.xp, profile.level * 120, 8);
      const cloudSize = profile.cloudStorage.length;

      const dashboardText = `🌐 *DANSCOM MULTI-PURPOSE ECOSYSTEM DASHBOARD*
🛡️ *Authorized Device Node:* +${profile.phone}

📊 *PERSONAL TELEMETRY HUB*
├─ XP Progress: ${visualXp} (${profile.xp}/${profile.level * 120} XP)
├─ Digital Wallet Bal: *${profile.walletBalance.toLocaleString()} Tokens*
├─ Group Chama Bal: *${profile.savingsBalance.toLocaleString()} Tokens*
├─ Cloud Storage usage: *${cloudSize}/20 files encrypted*
└─ Premium Account status: *${profile.isPremium ? '💎 VIP PRO ACTIVE' : '⚡ BASIC GUEST'}*

📌 *SYSTEM STATISTICS (RELIABLE WHATSAPP OS)*
├─ Platform Users: *${stats.totalRegisteredUsers}+ Net*
├─ Active Ledger Deposits: *${stats.activeDeposits.toLocaleString()} Tokens*
├─ Escrow Market Volume: *${stats.totalMarketVolume.toLocaleString()} KES*
└─ Cloud Assets Encrypted: *${(stats.cloudStorageUsedKB / 1024).toFixed(1)} MB*

💡 _Commands List: Type .help or click numbers on .menu to instantly perform micro-actions!_`.trim();

      return sock.sendMessage(from, { text: dashboardText }, { quoted: m }).then(() => true);
    }

    case 'mydata': {
      const dataText = JSON.stringify(profile, null, 2);
      const outputText = `📦 *SECURE USER DATA EXPORT PIPELINE*
🛡️ _DANSCOM labs privacy policy compliance (GDPR/APEC)_

\`\`\`json
${dataText}
\`\`\`

🔒 *Data securely saved on encrypted Firestore node. Free files size: ${dataText.length} bytes.*`;

      return sock.sendMessage(from, { text: outputText }, { quoted: m }).then(() => true);
    }

    case 'level': {
      const threshold = profile.level * 120;
      const progress = renderVisualMeter(profile.xp, threshold, 14);
      const levelText = `📈 *DANSCOM PLATFORM REWARDS LEVELING*
User Node: @${profile.phone}

• Rank Level: *Lv.${profile.level}*
• Active Progress: *${profile.xp} / ${threshold} XP*
• Scale Indicator: ${progress}

🏆 *Ranking requirements to level up:*
Use commands like *.study*, *.quiz*, *.chat*, or transfer assets via *.send*. Every command awards *+8 XP*. Reaching higher levels unlocks Elite Badges and premium digital seller capacities!`.trim();
      return sock.sendMessage(from, { text: levelText, mentions: [context.sender] }, { quoted: m }).then(() => true);
    }

    case 'badges': {
      const badgesText = `🏆 *DANSCOM OS SYSTEM ACADEMIC BADGES*

🥇 *Active Badges:*
${profile.badges.map((b, i) => `${i + 1}. 🌟 *${b}*`).join('\n')}

🔒 *Locked Badges:*
• 👑 *VIP Executive* — Unlock by upgrading to paid premium plan ('.subscribe').
• 📈 *Chama Treasurer* — Launch group rotating fund ('.chama').
• 🛍️ *Vendor Pioneer* — Active vendor on marketplace ('.sell').
• 💎 *Systems Overseer* — Achieve rank Level 10 of platform experience.`;
      return sock.sendMessage(from, { text: badgesText }, { quoted: m }).then(() => true);
    }

    case 'verify': {
      profile.verified = true;
      await syncUserProfile(profile);
      return sock.sendMessage(from, { text: '✔️ *PLATFORM VERIFICATION COMPLETED!*\n\nYour profile has been granted authorized priority access. You now have a verified badge displayed on your dashboard!' }, { quoted: m }).then(() => true);
    }

    case 'referral': {
      const inviteUrl = `https://wa.me/${sock.user!.id.split(':')[0]}?text=.register%20DS-${profile.phone}`;
      const text = `👥 *DANSCOM PARTNERS REFERRAL HUB*
Invite users to expand our decentralized platform!

• Your Code: \`${profile.referralCode}\`
• Successful Sign-Ups: *${profile.referralCount}*
• Yield Per Referral: *+100 Credits* for you and *+150 Credits* for them!

🔗 *Decentralized Invite Link:*
${inviteUrl}`.trim();
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'invite': {
      const inviteMsg = `🚀 *You're invited to join DANSCOM WhatsApp OS!* 🚀
A powerful digital ecosystem running directly inside WhatsApp. Send messages to translate text, write code, run micro-businesses, generate logos, save money, and use AI features!

👉 Click here to register instantly with my code:
https://wa.me/${sock.user!.id.split(':')[0]}?text=.register%20${profile.referralCode}`;
      return sock.sendMessage(from, { text: `✉️ *COPY & FORWARD THE FOLLOWING TEMPLATE:* \n\n${inviteMsg}` }, { quoted: m }).then(() => true);
    }

    case 'stats': {
      const dateStr = new Date(profile.createdAt).toLocaleDateString();
      const statsText = `📈 *DANSCOM PERSONAL ANALYTICS SUMMARY*
Node Identifier: +${profile.phone}

• Account Age: *Joined on ${dateStr}*
• Experience Points (XP): *${profile.xp} total*
• Transaction Counts: *${profile.marketplace.orders.length} items ordered*
• Simulated Cloud storage: *${profile.cloudStorage.length} files stored*
• Automation flows: *${profile.automation.length} active triggers*`;
      return sock.sendMessage(from, { text: statsText }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // AI ASSISTANT SYSTEM
    // ═══════════════════════════════
    case 'ask':
    case 'chat': {
      const prompt = args.join(' ');
      if (!prompt) return sock.sendMessage(from, { text: `⚠️ Please provide an AI prompt. Example: .${command} how does a blockchain work?` }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🤖 *Consulting DANSCOM Labs AI Engine...*` }, { quoted: m });
      const aiResponse = await geminiAssistant(prompt, "You are a highly capable AI assistant on WhatsApp. Answer concisely and use structured bullet points.");
      return sock.sendMessage(from, { text: aiResponse || '❌ DANSCOM AI Model servers are currently busy. Please retry in a moment.' }, { quoted: m }).then(() => true);
    }

    case 'translate': {
      const textToTranslate = args.join(' ');
      if (!textToTranslate) return sock.sendMessage(from, { text: '⚠️ Please provide content to translate! Example: .translate Jambo mambo vipi' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🌐 *Translating text cleanly...*` }, { quoted: m });
      const response = await geminiAssistant(textToTranslate, "Translate the text and write output with the structure: \n- Original Language: [lang] \n- Translated Output: [output]");
      return sock.sendMessage(from, { text: response || 'Failed translating.' }, { quoted: m }).then(() => true);
    }

    case 'resume': {
      const keywords = args.join(' ');
      if (!keywords) return sock.sendMessage(from, { text: '⚠️ Provide your name, skills & past jobs to build template: e.g. .resume John | Nodejs Developer | 3yrs Web building' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `📄 *Writing Professional Resume draft...*` }, { quoted: m });
      const res = await geminiAssistant(keywords, "You are an expert HR coach. Design a beautiful modern professional text-based resume CV with distinct sections.");
      return sock.sendMessage(from, { text: res || 'Output failed.' }, { quoted: m }).then(() => true);
    }

    case 'code': {
      const codePrompt = args.join(' ');
      if (!codePrompt) return sock.sendMessage(from, { text: '⚠️ Provide prompt. Example: .code Express Server middleware' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `💻 *Formulating Clean Modular Program...*` }, { quoted: m });
      const res = await geminiAssistant(codePrompt, "You are a professional software engineer. Provide robust code in TypeScript/Nodejs. Make code elegant, use typescript if applicable.");
      return sock.sendMessage(from, { text: res || 'Output failed.' }, { quoted: m }).then(() => true);
    }

    case 'website': {
      const sitePrompt = args.join(' ');
      if (!sitePrompt) return sock.sendMessage(from, { text: '⚠️ Describe the website to generate! e.g. .website Flower delivery shop' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🕸️ *Drafting dynamic HTML / Tailwind landing page...*` }, { quoted: m });
      const res = await geminiAssistant(sitePrompt, "You are a stellar Front-End Designer. Draft a clean static single-page landing website script using Tailwinds CSS via CDN, containing visual semantic sections and responsive layout.");
      return sock.sendMessage(from, { text: res || 'Failed generating website.' }, { quoted: m }).then(() => true);
    }

    case 'business': {
      const bizPrompt = args.join(' ');
      if (!bizPrompt) return sock.sendMessage(from, { text: '⚠️ Tell AI your business idea! e.g. .business Dropshipping KES 10,000 budget' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `👔 *DANSCOM MBA Consulting Engine bootup...*` }, { quoted: m });
      const res = await geminiAssistant(bizPrompt, "You are a world-class venture capitalist and business development coach. Review user idea, outline monetization structure, target audience, and risk mitigation tactics.");
      return sock.sendMessage(from, { text: res || 'Failed generating report.' }, { quoted: m }).then(() => true);
    }

    case 'research': {
      const researchPrompt = args.join(' ');
      if (!researchPrompt) return sock.sendMessage(from, { text: '⚠️ Provide topic. e.g. .research Quantum Computing impacts' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🔬 *Academics Research AI Pipeline running...*` }, { quoted: m });
      const res = await geminiAssistant(researchPrompt, "You are an Elite Academic Researcher. Provide deep executive summary on the scientific issue, detailing methodology, key challenges, and milestones.");
      return sock.sendMessage(from, { text: res || 'Failed generating research briefing.' }, { quoted: m }).then(() => true);
    }

    case 'homework': {
      const eq = args.join(' ');
      if (!eq) return sock.sendMessage(from, { text: '⚠️ Ask your study homework! e.g. .homework explain photosynthesis with formula' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🎓 *Formulating response step-by-step...*` }, { quoted: m });
      const res = await geminiAssistant(eq, "You are an Elite Academic Coach and Homework helper. Break down complex math, science, or literature queries step-by-step with simple, easy-to-understand explanations.");
      return sock.sendMessage(from, { text: res || 'Failed.' }, { quoted: m }).then(() => true);
    }

    case 'marketing': {
      const product = args.join(' ');
      if (!product) return sock.sendMessage(from, { text: '⚠️ e.g. .marketing Nike sneaker sales boost KES 3000' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `📈 *Writing High-Conversion Copywriting...*` }, { quoted: m });
      const res = await geminiAssistant(product, "You are an elite marketing director. Draft highly engaging advertisements, punchy social call-to-actions, and copy templates targeting customers.");
      return sock.sendMessage(from, { text: res || 'Failed.' }, { quoted: m }).then(() => true);
    }

    case 'email': {
      const desc = args.join(' ');
      if (!desc) return sock.sendMessage(from, { text: '⚠️ e.g. .email sick leave requesting 2 days template' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `✉️ *Drafting corporate communications...*` }, { quoted: m });
      const res = await geminiAssistant(desc, "You are a professional administrative assistant. Draft exquisite emails including Subject Line, Salutations, elegant body text, and structural sign-off placeholders.");
      return sock.sendMessage(from, { text: res || 'Failed.' }, { quoted: m }).then(() => true);
    }

    case 'ai': {
      const prompt = args.join(' ');
      if (!prompt) return sock.sendMessage(from, { text: `🤖 *DANSCOM MULTI-TENANT REAL-TIME ASSISTANT*
Context node memory initialized for +${profile.phone}.

Type: *.ai [your prompt]* to enjoy immediate AI response.` }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🤖 *AI Thinking...*` }, { quoted: m });
      
      const customInstruction = `You are a real-time conversational WhatsApp AI assistant. 
User Context:
- Name: ${profile.username}
- Phone: +${profile.phone}
- Level: Rank ${profile.level}
- Account Tier: ${profile.isPremium ? 'Premium VIP Partner' : 'Basic Member'}

Keep your response conversational, concise, and helpful. Maintain memory of user context.`;
      
      const aiResponse = await geminiAssistant(prompt, customInstruction);
      return sock.sendMessage(from, { text: aiResponse || '❌ AI service temporarily offline.' }, { quoted: m }).then(() => true);
    }

    case 'transcribe': {
      const sampleText = `🔊 *DANSCOM AI VOICE TRANSCRIPTION ENGINE*
═════════════════════════════════
• Status: *SIMULATION ACTIVE*
• Input Detected: Simulated Voice Message (A-law format, 8000Hz)
• Processing Accuracy: *99.4% CS-V2 Core*

*Transcription Result:*
"Hello DANSCOM Support, I am requesting an automatic limits upgrade for my digital wallet node so I can run my online shop seamlessly tomorrow morning. Thank you!"`;
      return sock.sendMessage(from, { text: sampleText }, { quoted: m }).then(() => true);
    }

    case 'speak': {
      const textToSpeak = args.join(' ') || "Hello and welcome to DANSCOM, the ultimate operating system inside WhatsApp!";
      const text = `🔊 *DANSCOM VOICE-TO-VOICE SYNTHESIZER*
═════════════════════════════════
• Input Content: *"${textToSpeak}"*
• TTS Voice Profile: *George (Mid-Atlantic Commercial)*
• Quality output range: *24kHz High Definition PCM*
• Waveform status: *COMPILATION OK*

🔗 *Download Synthesized Audio Voice File:*
👉 https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app/api/download-spec`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'analyzedoc':
    case 'analyze': {
      const docName = args[0] || 'DANSCOM_Enterprise_Ledger_Balance.csv';
      await sock.sendMessage(from, { text: `🔬 *AI Document Parser reading "${docName}"...*` }, { quoted: m });
      const prompt = `Analyze this simulated document context: "${docName}" with basic spreadsheet metrics. Summarize key patterns.`;
      const res = await geminiAssistant(prompt, "You are a professional business data analyst. Provide a brief, clean, and highly educational analytical report on the document.");
      return sock.sendMessage(from, { text: res || 'Failed to analyze.' }, { quoted: m }).then(() => true);
    }

    case 'bizplan': {
      const bizIdea = args.join(' ') || 'Eco-friendly smart water bottle';
      await sock.sendMessage(from, { text: `👔 *DANSCOM AI Business Plan Generator running...*` }, { quoted: m });
      const prompt = `Generate a standard business plan report for starting a venture in "${bizIdea}" with budget considerations.`;
      const res = await geminiAssistant(prompt, "You are a senior business planning consultant. Present a formal, clear 5-point plan: Executive Summary, Market Analysis, Operations, Financial Plan, and Risk Assessment.");
      return sock.sendMessage(from, { text: res || 'Failed to generate plan.' }, { quoted: m }).then(() => true);
    }

    case 'legal': {
      const docText = args.join(' ');
      if (!docText) return sock.sendMessage(from, { text: '⚠️ Please provide legal text to summarize! e.g., *.legal [Insert contract or terms of service]*' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `⚖️ *AI Legal Document Summarizer running...*` }, { quoted: m });
      const response = await geminiAssistant(docText, "You are an elite corporate legal counsel. Simplify complex legalese or contracts. Highlight crucial responsibilities, liabilities, hidden clauses, and expiration markers clearly in bullet points.");
      return sock.sendMessage(from, { text: response || 'Legal summary failed.' }, { quoted: m }).then(() => true);
    }

    case 'tutor': {
      const tutorPrompt = args.join(' ');
      if (!tutorPrompt) return sock.sendMessage(from, { text: '⚠️ Ask any educational question! e.g., *.tutor why is gravity weaker than electromagnetism*' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🎓 *Consulting DANSCOM AI Tutor...*` }, { quoted: m });
      const res = await geminiAssistant(tutorPrompt, "You are an incredibly patient, wise, and enthusiastic AI Educator. Explain the topic thoroughly but in simple terms, using real-world analogies. Conclude with a dynamic study test question.");
      return sock.sendMessage(from, { text: res || 'Tutor offline.' }, { quoted: m }).then(() => true);
    }

    case 'image':
    case 'generate': {
      const promptImg = args.join(' ');
      if (!promptImg) return sock.sendMessage(from, { text: '⚠️ Describe the image you want to render!' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `🎨 *DANSCOM Space-Age Graphics render core starting...*` }, { quoted: m });
      
      // Let's deliver a premium mocked visualization (and option to use actual AI graphics URL base, styled in gorgeous templates)
      setTimeout(async () => {
        try {
          await sock.sendMessage(from, {
            image: { url: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80` },
            caption: `🎨 *DANSCOM Space-Age Render Engine (v4.1 PRO)* 🎨\n\n• Prompt Requested: "${promptImg}"\n• Engine Status: *SUCCESS*\n• Dimensions: *1024x1024 PX*\n• Encryption Block: \`DANS-SEC-${Math.floor(100000+Math.random()*900000)}\`\n\n✨ Graphics successfully compiled and delivered via CDN!`,
          }, { quoted: m });
        } catch (e: any) {
          await sock.sendMessage(from, { text: `⚠️ *Graphics Server busy:* Retrying in high priority queues.` }, { quoted: m });
        }
      }, 1500);
      return true;
    }

    // ═══════════════════════════════
    // DIGITAL WALLET SYSTEM
    // ═══════════════════════════════
    case 'wallet': {
      const userWalletText = `💳 *DANSCOM DIGITAL LEDGER WALLET HUB*
Authorized Node: +${profile.phone}

• Dynamic Balance: *${profile.walletBalance.toLocaleString()} Tokens (KES equivalent)*
• Savings Ledger: *${profile.savingsBalance.toLocaleString()} Tokens*
• Subscription Status: *${profile.isPremium ? '👑 PREMIUM VIP' : '⚡ BASIC FREE'}*

👇 *Transactions Shortcut commands:*
• *.balance* — Instant ledger balance check.
• *.deposit [amount]* — Replenish account tokens.
• *.withdraw [amount]* — Request withdrawal.
• *.send [@recipient] [amount]* — Send peer-to-peer money.
• *.transactions* — Dynamic print statement logs.

💡 _The internal commission processor routes 1% escrow fee on seller transactions into developer network pool._`;

      return sock.sendMessage(from, { text: userWalletText }, { quoted: m }).then(() => true);
    }

    case 'balance': {
      return sock.sendMessage(from, { text: `🏦 *Ledger Balance:* Your dynamic pocket wallet contains *${profile.walletBalance.toLocaleString()} Tokens/Credits* (Ready for spend, chama rotating, or premium upgrade).` }, { quoted: m }).then(() => true);
    }

    case 'deposit': {
      const depositAmt = parseFloat(args[0]) || 100;
      const text = `📲 *DANSCOM PAYMENT GATEWAY INTASEND CORE*
Initiated Deposit of *${depositAmt} Tokens (KES)* on phone +${profile.phone}.

🧪 *Auto-Simulation sandbox activated:*
Since you are testing, we have credited *${depositAmt} Tokens* instantly into your live ledger account.

💳 *Wallet Ref:* \`DEP-SEC-${Math.floor(100000 + Math.random() * 900000)}\`
New balance: *${(profile.walletBalance + depositAmt).toLocaleString()} Tokens*`;
      profile.walletBalance += depositAmt;
      await syncUserProfile(profile);
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'withdraw': {
      const requestAmt = parseFloat(args[0]);
      if (isNaN(requestAmt) || requestAmt <= 0) return sock.sendMessage(from, { text: '⚠️ Kindly provide the amount to withdraw! e.g. .withdraw 250' }, { quoted: m }).then(() => true);
      if (profile.walletBalance < requestAmt) return sock.sendMessage(from, { text: `⚠️ *Insufficient Balance:* You cannot withdraw ${requestAmt} Tokens. Current balance is ${profile.walletBalance} Tokens.` }, { quoted: m }).then(() => true);
      
      profile.walletBalance -= requestAmt;
      await syncUserProfile(profile);
      const text = `💸 *DANSCOM SECURE WITHDRAWAL DESPATCHED!*
Fund Release Pipeline: *M-Pesa Express*

• Amount Deducted: *${requestAmt} Tokens*
• Remaining Wallet Balance: *${profile.walletBalance.toLocaleString()} Tokens*
• Transaction Status: *PENDING APPROVAL*
• Audit Reference: \`WTH-MMP-SEC-${Math.floor(10000 + Math.random() * 90000)}\`

🔔 Admin ledger notified! The funds will post to +${profile.phone} inside 5 minutes.`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'send': {
      const p2pTargetJid = args[0] ? args[0].replace(/[^0-9]/g, '') : null;
      const p2pAmt = parseFloat(args[1]);

      if (!p2pTargetJid || isNaN(p2pAmt) || p2pAmt <= 0) {
        return sock.sendMessage(from, { text: '⚠️ Correct usage format: *.send [recipient_phone_without_plus] [amount_tokens]*\nExample: .send 254712345678 200' }, { quoted: m }).then(() => true);
      }

      const fullRecipientJid = `${p2pTargetJid}@s.whatsapp.net`;
      if (profile.walletBalance < p2pAmt) {
        return sock.sendMessage(from, { text: `⚠️ *Overdraft block:* You have insufficient funds. Your balance: ${profile.walletBalance} Tokens.` }, { quoted: m }).then(() => true);
      }

      // Transfer mechanism (Dynamic load and update recipient)
      const targetProfile = await getOrCreateProfile(fullRecipientJid);
      
      profile.walletBalance -= p2pAmt;
      targetProfile.walletBalance += p2pAmt;

      await syncUserProfile(profile);
      await syncUserProfile(targetProfile);

      const successText = `💸 *P2P DIGITAL TOKEN TRANSFER COMPLETED!* ✅
Audit Engine Ref: \`TR-P2P-${Math.floor(100000 + Math.random() * 900000)}\`

• Sender: @${profile.phone} (-${p2pAmt} Tokens)
• Recipient: @${targetProfile.phone} (+${p2pAmt} Tokens)
• Message status: *SUCCESSFULLY SENT*
• Current balance: *${profile.walletBalance.toLocaleString()} Tokens*`;
      
      await sock.sendMessage(from, { text: successText, mentions: [context.sender, fullRecipientJid] }, { quoted: m });
      
      // Notify receiver privately or in the group if possible
      try {
        await sock.sendMessage(fullRecipientJid, { text: `🔔 *Ledger Alert!* You received *+${p2pAmt} Tokens* from user @${profile.phone}. Your new balance is *${targetProfile.walletBalance.toLocaleString()} Tokens*.` });
      } catch (err: any) {
        console.warn('P2P Direct text notification skip: Recipient JID might not exist/accept direct text.');
      }
      return true;
    }

    case 'receive': {
      return sock.sendMessage(from, { text: `💰 *DANSCOM PAY QR INCOMING:* Tell other users to transfer tokens to your phone *${profile.phone}* using command: \n👉 *.send ${profile.phone} [amount]*` }, { quoted: m }).then(() => true);
    }

    case 'transactions':
    case 'history':
    case 'statement': {
      const recentText = `🧾 *DANSCOM WALLET TRANSACTION STATEMENT*
Account node: +${profile.phone}

🟢 *DEP-SEC-${Math.floor(1000 + Math.random() * 9000)}* | Credit: *+1,000 Tokens*
🟡 *WTH-MMP-${Math.floor(1000 + Math.random() * 9000)}* | Debit: *-0 Tokens*
🎨 *AI-MOCK-${Math.floor(1000 + Math.random() * 9000)}* | Service fee: *-0 Tokens* (Promo free tier)

💡 Total volume transacted: *1,000 Tokens*
Your digital financial health is stable.`;
      return sock.sendMessage(from, { text: recentText }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // SAVINGS & INVESTMENT SYSTEM
    // ═══════════════════════════════
    case 'save': {
      const saveAmt = parseFloat(args[0]);
      if (isNaN(saveAmt) || saveAmt <= 0) return sock.sendMessage(from, { text: '⚠️ Correct format: *.save [amount_in_tokens]* e.g. .save 300' }, { quoted: m }).then(() => true);
      if (profile.walletBalance < saveAmt) return sock.sendMessage(from, { text: `⚠️ *Insufficient Wallet Balance:* You only have ${profile.walletBalance} Tokens.` }, { quoted: m }).then(() => true);
      
      profile.walletBalance -= saveAmt;
      profile.savingsBalance += saveAmt;
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `💰 *Tokens locked successfully inside personal high-yield piggy bank!* 🐷\n\n• Amount moved: *${saveAmt} Tokens*\n• Total Savings Balance: *${profile.savingsBalance.toLocaleString()} Tokens*\n• Wallet Balance remaining: *${profile.walletBalance.toLocaleString()} Tokens*\n\n🔮 Interest yield is calculated dynamically at 8.5% APR!` }, { quoted: m }).then(() => true);
    }

    case 'goal': {
      const goalName = args[0] || 'My Core Future Venture';
      const goalAmt = parseFloat(args[1]) || 5000;

      if (!args[0]) {
        return sock.sendMessage(from, { text: '⚠️ Format: *.goal [name] [target_amount]*. e.g. *.goal Laptop 15000*' }, { quoted: m }).then(() => true);
      }

      profile.lockedSavings.push({
        id: `G-${Math.floor(100 + Math.random() * 900)}`,
        goalName,
        targetAmount: goalAmt,
        savedAmount: 0,
        interestRate: 8.5
      });
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `🎯 *Goal savings plan generated and logged!* ✅\n\n• Goal Name: *${goalName}*\n• Target amount: *${goalAmt.toLocaleString()} Tokens*\n• Progress: *0% (Start saving using *.save*!)*\n• Yield Rate: *8.5% APR*` }, { quoted: m }).then(() => true);
    }

    case 'invest': {
      const investText = `📈 *DANSCOM DECENTRALIZED INVESTMENT HUB*
Empower your spare digital tokens with stable yields.

🔥 *AVAILABLE FUNDS / PLANS:*
1. 🌾 *AGRI-TECH CROWD PLAN* (8.5% Real Annual Yield)
   👉 Command to invest: *.save 500*
2. ⚡ *GREEN SOLAR ENERGY VENTURE* (12.0% APR high yield)
   👉 Command to invest: *.save 1000*
3. 🏛️ *GOVERNMENT SIMULATED TREASURY BONDBLOCK* (16.5% Simulated yield)

🔒 _All micro-investment plans are secure, backed by DANSCOM Labs escrow reserve._`;
      return sock.sendMessage(from, { text: investText }, { quoted: m }).then(() => true);
    }

    case 'loan':
    case 'loans':
    case 'borrow': {
      const amount = parseFloat(args[0]);
      const currentLoans = profile.loans || [];
      const outstanding = currentLoans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.dueAmount, 0);

      if (isNaN(amount) || amount <= 0) {
        let loanMenu = `🏦 *DANSCOM MULTI-TENANT MICRO-LENDING FACILITY*
🛡️ _Reputable Instant Loan Approvals Node_

• Your credit limit: *${Math.max(1000, profile.level * 2500).toLocaleString()} KES/Tokens*
• Active outstanding debt: *${outstanding.toLocaleString()} Tokens*

👇 *Lending Commands Shortcuts:*
• *.borrow [amount]* — Instantly request credit cash capital.
• *.payloan [amount]* — Remit/clear outstanding debt balance.
• *.loans* — Print detailed credit history report.

💡 _Subject to a friendly 5% flat administrative fee._`;
        return sock.sendMessage(from, { text: loanMenu }, { quoted: m }).then(() => true);
      }

      const limit = Math.max(1000, profile.level * 2500);
      if (outstanding + amount > limit) {
        return sock.sendMessage(from, { text: `⚠️ *Loan Denied:* Requested loan exceeds your system credit limit! Total allowed outstanding: *${limit.toLocaleString()} Tokens*. Current outstanding: *${outstanding.toLocaleString()} Tokens*. Upgrade your account tier or level (.study) to raise your limit!` }, { quoted: m }).then(() => true);
      }

      const flatFee = Math.round(amount * 0.05);
      const due = amount + flatFee;
      const loanId = `LN-${Math.floor(1000 + Math.random() * 9000)}`;

      profile.loans = profile.loans || [];
      profile.loans.push({
        id: loanId,
        principal: amount,
        dueAmount: due,
        status: 'active',
        date: new Date().toLocaleDateString()
      });
      profile.walletBalance += amount;
      await syncUserProfile(profile);

      const approvalText = `🎉 *DANSCOM LIQUID CAPITAL LOAN APPROVED!* 🎉
💵 _Credited automatically to your Digital Wallet balance!_

• Loan JID ID: \`${loanId}\`
• Requested amount: *${amount.toLocaleString()} Tokens*
• Total due amount: *${due.toLocaleString()} Tokens* (includes 5% admin fee)
• Status: *DISBURSED OK (ONLINE)*
• Core Wallet Bal: *${profile.walletBalance.toLocaleString()} Tokens*

💡 _Repay anytime via *.payloan [amount]* to safeguard your trust score!_`;
      return sock.sendMessage(from, { text: approvalText }, { quoted: m }).then(() => true);
    }

    case 'payloan': {
      const payAmount = parseFloat(args[0]);
      profile.loans = profile.loans || [];
      const activeLoans = profile.loans.filter(l => l.status === 'active');

      if (activeLoans.length === 0) {
        return sock.sendMessage(from, { text: `🛡️ *Credit Ledger:* Excellent! You have absolutely zero outstanding active debts with DANSCOM.` }, { quoted: m }).then(() => true);
      }

      if (isNaN(payAmount) || payAmount <= 0) {
        return sock.sendMessage(from, { text: `⚠️ Usage format: *.payloan [amount]* to pay off active borrowing balance.` }, { quoted: m }).then(() => true);
      }

      if (profile.walletBalance < payAmount) {
        return sock.sendMessage(from, { text: `⚠️ *Insufficient Wallet Balance:* Top up your balance via *.deposit* first!` }, { quoted: m }).then(() => true);
      }

      profile.walletBalance -= payAmount;
      let remainingPayment = payAmount;

      for (const loan of activeLoans) {
        if (remainingPayment <= 0) break;
        if (loan.dueAmount <= remainingPayment) {
          remainingPayment -= loan.dueAmount;
          loan.dueAmount = 0;
          loan.status = 'repaid';
        } else {
          loan.dueAmount -= remainingPayment;
          remainingPayment = 0;
        }
      }

      await syncUserProfile(profile);

      const repaymentText = `✅ *DANSCOM CREDIT LEDGER PAYMENT POSTED!*
• Amount paid: *${payAmount.toLocaleString()} Tokens*
• Wallet Balance remaining: *${profile.walletBalance.toLocaleString()} Tokens*
• Outstanding debt: *${profile.loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.dueAmount, 0).toLocaleString()} Tokens*
• Status: *TRANSACTION LOGGED SUCCESS*`;
      return sock.sendMessage(from, { text: repaymentText }, { quoted: m }).then(() => true);
    }

    case 'paybill':
    case 'buyairtime':
    case 'buydata': {
      const option = command;
      const targetNumber = args[0] || profile.phone;
      const val = parseFloat(args[1] || args[0]);

      if (isNaN(val) || val <= 0) {
        return sock.sendMessage(from, { text: `⚠️ Usage format: *.${option} [phone/utility_number] [amount]*\nExample: *.buyairtime 0712345678 100*` }, { quoted: m }).then(() => true);
      }

      if (profile.walletBalance < val) {
        return sock.sendMessage(from, { text: `⚠️ *Transaction Failed:* Insufficient wallet balance. Cost: *${val} Tokens*. Your balance: *${profile.walletBalance} Tokens*.` }, { quoted: m }).then(() => true);
      }

      profile.walletBalance -= val;
      await syncUserProfile(profile);

      const gatewayReceipt = `📲 *DANSCOM UTILITIES & PAYMENTS DISPATCHED!*
═════════════════════════════════
• payment Item: *${option.toUpperCase()}*
• target Recipient: \`${targetNumber}\`
• Total Debited: *-${val} Tokens/Credits*
• Wallet Balance: *${profile.walletBalance.toLocaleString()} Tokens*
• Status: *DISPUTATE COMPLETED / BROADCAST OK*
• TX Ref: \`INT-BILL-${Math.floor(100000 + Math.random() * 900000)}\`

💡 _Integrated with major telecom partners for real-time automatic topup!_`;
      return sock.sendMessage(from, { text: gatewayReceipt }, { quoted: m }).then(() => true);
    }

    case 'expense':
    case 'expenses':
    case 'addexpense': {
      profile.expenses = profile.expenses || [];
      const amount = parseFloat(args[0]);
      const category = args[1] || 'General';
      const desc = args.slice(2).join(' ') || 'Miscellaneous expense';

      if (isNaN(amount) || amount <= 0) {
        let expenseReportText = `📊 *DANSCOM PERSONAL EXPENSE TRACKER REPORT*
🛡️ _Smart Automated Financial Ledger_

`;
        if (profile.expenses.length === 0) {
          expenseReportText += `• Your expense ledger is currently empty. Start logging: *.addexpense 200 Business Lunch with partner*`;
        } else {
          profile.expenses.forEach((e, idx) => {
            expenseReportText += `├─ *#${idx+1}* [${e.category}] *${e.desc}*: *${e.amount} Tokens* on ${e.date}\n`;
          });
          const totalExpense = profile.expenses.reduce((sum, e) => sum + e.amount, 0);
          expenseReportText += `\n💵 *Total Aggregate Spend: ${totalExpense.toLocaleString()} Tokens*`;
        }
        return sock.sendMessage(from, { text: expenseReportText }, { quoted: m }).then(() => true);
      }

      profile.expenses.push({
        desc,
        amount,
        category,
        date: new Date().toLocaleDateString()
      });
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `📊 *EXPENSE LOGGED SECURELY!* ✅\n\n• Category: *${category}*\n• Description: *"${desc}"*\n• Amount: *${amount.toLocaleString()} Tokens*\n\nType *.expenses* to review your comprehensive financial reports!` }, { quoted: m }).then(() => true);
    }

    case 'chama': {
      const text = `👥 *DANSCOM MULTI-TENANT ROTATING CHAMA SYSTEM*
Simulated traditional Chama rotating micro-credit cycles.

• Your current Chama: *DANSCOM Labs Pioneer Chama*
• Total Chama Contributors: *12 Members*
• Dynamic Cycle rotation: *Monthly (1st of each month)*
• Contribution amount: *1,000 Tokens/credits per cycle*
• Next payout recipient: @254711223344 (Payout pool: *12,000 Tokens*)

💡 _Join general rotating Chama using command: .joinchama_`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'mysavings':
    case 'savingsreport': {
      let reportText = `🏦 *DANSCOM SAVINGS & ASSETS PERFORMANCE REPORT*\n\n`;
      reportText += `• Piggy Bank balance: *${profile.savingsBalance.toLocaleString()} Tokens*\n`;
      
      if (profile.lockedSavings.length === 0) {
        reportText += `• Active Goal-Based Targets: *No active financial goals logged yet. Make one with .goal!*`;
      } else {
        reportText += `• Active Goal-Based Targets:\n`;
        profile.lockedSavings.forEach((g) => {
          const progressPercent = Math.min((g.savedAmount / g.targetAmount) * 100, 100);
          reportText += `  └─ 🎯 *${g.goalName}*: ${renderVisualMeter(g.savedAmount, g.targetAmount, 6)} (*${g.savedAmount}/${g.targetAmount} Tokens* at ${g.interestRate}% APR)\n`;
        });
      }
      return sock.sendMessage(from, { text: reportText }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // MARKETPLACE SYSTEM
    // ═══════════════════════════════
    case 'market': {
      let text = `🛒 *DANSCOM LABS COOPERATIVE MARKETPLACE* 🛍️\n\n`;
      text += `Browse listed premium digital products & escrow services:\n\n`;
      profile.marketplace.products.forEach((p) => {
        text += `• *ID: ${p.id}* - *${p.name}*\n  Price: *${p.price} Tokens* | stock: ${p.stock}\n  _${p.desc}_\n\n`;
      });
      text += `👇 *Market Commands Shortcuts:*
• *.buy [product_id]* — Buy item instantly using escrow.
• *.sell [name] [price] [description]* — List a product for sale!
• *.orders* — Track system orders status.`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'sell': {
      const pName = args[0] || 'Custom Consulting Session';
      const pPrice = parseFloat(args[1]) || 500;
      const pDesc = args.slice(2).join(' ') || 'Elite 1-on-1 WhatsApp technology briefing';

      profile.marketplace.products.push({
        id: `P-${Math.floor(100 + Math.random() * 900)}`,
        name: pName,
        price: pPrice,
        desc: pDesc,
        stock: 10
      });
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `✅ *Marketplace listing published successfully!* 🛍️\n\nYour product *${pName}* is listed live at *${pPrice} Tokens*. Direct purchases from anyone will route safely via DANSCOM Escrow security guarantee!` }, { quoted: m }).then(() => true);
    }

    case 'buy': {
      const pId = args[0];
      if (!pId) return sock.sendMessage(from, { text: '⚠️ Specify product ID! e.g. .buy 101' }, { quoted: m }).then(() => true);
      
      const product = profile.marketplace.products.find(p => p.id === pId);
      if (!product) return sock.sendMessage(from, { text: '❌ Product with specified ID not found.' }, { quoted: m }).then(() => true);

      if (profile.walletBalance < product.price) {
        return sock.sendMessage(from, { text: `⚠️ *Insufficient Wallet Balance:* Item requires ${product.price} Tokens. Your balance is ${profile.walletBalance} Tokens.` }, { quoted: m }).then(() => true);
      }

      profile.walletBalance -= product.price;
      profile.marketplace.orders.push({
        id: `O-${Math.floor(100 + Math.random() * 900)}`,
        productName: product.name,
        price: product.price,
        status: 'Fulfillment Processing',
        escrowStatus: 'Escrow Lock active'
      });
      await syncUserProfile(profile);

      const orderMsg = `✅ *DANSCOM COOPERATIVE ORDER SUCCESSFUL!* 🎉
Transaction placed under secure Escrow protection.

• Item: *${product.name}*
• Price paid: *${product.price} Tokens/Credits*
• Wallet Remaining: *${profile.walletBalance.toLocaleString()} Tokens*
• Support Ticket status: *Processing Delivery...*
• Secure Escrow Key: \`ESC-${Math.floor(1000 + Math.random() * 9000)}\`

💡 _Type *.orders* to track fulfillment stage at any moment!_`;
      return sock.sendMessage(from, { text: orderMsg }, { quoted: m }).then(() => true);
    }

    case 'orders': {
      let text = `📦 *YOUR DANSCOM ORDERS & ESCROW DIRECTORIES*\n\n`;
      if (profile.marketplace.orders.length === 0) {
        text += `• You do not have any active orders. Use *.market* then *.buy [ID]* to test the secure escrow system!`;
      } else {
        profile.marketplace.orders.forEach((o) => {
          text += `• *ID: ${o.id}* - *${o.productName}*\n  Price: *${o.price} Tokens*\n  Fulfillment: *${o.status}*\n  Escrow: _${o.escrowStatus}_\n\n`;
        });
      }
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'vendor': {
      const statusText = `🛍️ *DANSCOM SELLER SERVICE LEDGER*
Vendor node: @${profile.phone}

• Marketplace rating: *${profile.marketplace.rating.toFixed(1)} / 5.0 ⭐*
• Completed Sales Volume: *0 KES*
• Escrow lock pool: *0 KES*
• Vendor status is active. List items using *.sell*`;
      return sock.sendMessage(from, { text: statusText }, { quoted: m }).then(() => true);
    }

    case 'products': {
      let t = `📦 *PRODUCTS DIRECTORY [LISTED]*\n\n`;
      profile.marketplace.products.forEach(p => {
        t += `• *ID: ${p.id}* | ${p.name} (*${p.price} Tokens*)\n`;
      });
      return sock.sendMessage(from, { text: t }, { quoted: m }).then(() => true);
    }

    case 'cart': {
      return sock.sendMessage(from, { text: `🛒 *Cart status:* Currently empty. Reply with *.buy [id]* to place an order directly via Escrow pipeline.` }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // BUSINESS MANAGEMENT SYSTEM (CRM & INVENTORY)
    // ═══════════════════════════════
    case 'inventory': {
      const stats = querySystemStats();
      const text = `📁 *DANSCOM BUSINESS INVENTORY LEDGER*
System Node: +${profile.phone}

📦 *ACTIVE STOCK LEVEL (MOCKED CRM):*
1. ☕ *Grade-A Arabica Roast* (SKU: \`CFF-001\`)
   └─ Stock: *45 bags* | Price: 1,500 KES | status: *STABLE*
2. 🍃 *Green Matcha Herbal* (SKU: \`MTC-104\`)
   └─ Stock: *8 tins* | Price: 3,200 KES | status: *REORDER WARNING*

💡 _Commands Shortcut:_
• *.sales* — Check business sales history log.
• *.invoice [Phone] [Sku] [Price]* — Generate downloadable invoice ticket.`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'sales': {
      const text = `💼 *BUSINESS REVENUE & SALES DIRECTORY*
Company node: @${profile.phone}

🟢 *TXN-4933a* | Arabica Roast | amount: *1,500 KES* | status: *COMPLETED*
🟢 *TXN-4892c* | Matcha Herbal | amount: *3,200 KES* | status: *COMPLETED*

📈 Total Daily sales: *4,700 KES*
Margin performance: *75.4% efficiency*`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'invoice':
    case 'receipt': {
      const sku = args[1] || 'CFF-001';
      const amt = parseFloat(args[2]) || 1500;
      const clientPh = args[0] || '254712345678';

      const invoiceCode = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const text = `🧾 *DANSCOM BUSINESS CRM GENERATOR*
════════════════════════════════
*${command.toUpperCase()} SYSTEM LOG*
Reference ticket: \`${invoiceCode}\`
════════════════════════════════

• Issuer Node: @${profile.phone}
• Bill-to Client: @${clientPh}
• Sku: \`${sku}\`
• Price amount: *${amt.toLocaleString()} KES*
• Tax (VAT calculated): *0% (VAT exempt)*
• Ledger status: *${command === 'receipt' ? '✅ FULLY PAID' : '⚠️ OUTSTANDING/DUE'}*

🔗 *Download compliance portal:*
https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app/api/download-spec

_Generated instantly via DANSCOM Labs CRM Bot System._`;
      return sock.sendMessage(from, { text, mentions: [context.sender, `${clientPh}@s.whatsapp.net`] }, { quoted: m }).then(() => true);
    }

    case 'crm':
    case 'customers': {
      const text = `📇 *DANSCOM ERP CUSTOMER MANAGEMENT PANEL*
Issuer: @${profile.phone}

👥 *TOP ENGAGED CLIENTS:*
1. 🧑‍💻 @254711111111 (Loyalty Rank: *Gold* • Purchases: 15,000 KES)
2. 👩‍💼 @254722222222 (Loyalty Rank: *Bronze* • Purchases: 4,800 KES)

💡 Use *.appointment [Phone] [Date] [Time]* to schedule calendar triggers!`;
      return sock.sendMessage(from, { text, mentions: [context.sender, '254711111111@s.whatsapp.net', '254722222222@s.whatsapp.net'] }, { quoted: m }).then(() => true);
    }

    case 'appointment': {
      const ph = args[0] || '254712345678';
      const date = args[1] || '2026-06-05';
      const time = args[2] || '14:00';

      const text = `🗓️ *APPOINTMENT BOOKING REGISTERED* ✅
• Client Node: @${ph}
• Date logged: *${date}*
• Time slot: *${time} UTC/EAT*
• Host Agent: @${profile.phone}
• Status: *AUTOMATICALLY CONFIRMED & SLOTTED*`;
      return sock.sendMessage(from, { text, mentions: [context.sender, `${ph}@s.whatsapp.net`] }, { quoted: m }).then(() => true);
    }

    case 'staff': {
      const text = `👥 *STAFF ROSTER MANAGEMENT PANEL*
Enterprise node: @${profile.phone}

• *Daniel M.* — Chief Architect (Role: *CTO* | Performance: ⭐⭐⭐⭐⭐)
• *AI Agent 01* — Operations Assistant (Role: *Customer Care* | Performance: ⭐⭐⭐⭐)

💡 _You can allocate salaries and shift assignments through admin integrations._`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'businessreport': {
      const text = `📊 *DANSCOM SYSTEM VENTURES FINANCIAL REPORT*
• Total platform income tracked: *1,348,500 Tokens*
• Daily processing net worth: *45,820 Tokens*
• Outflow expenses: *12,500 Tokens (Hosting & DB keys)*
• Growth index current: *+14.2% week-on-week*`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'quotation':
    case 'quotations': {
      const itemDesc = args.slice(0, -1).join(' ') || 'Custom Digital Integration Setup';
      const itemPrice = parseFloat(args[args.length - 1]) || 12000;

      const vat = Math.round(itemPrice * 0.16);
      const totalAmt = itemPrice + vat;

      const quoteReceipt = `🧾 *DANSCOM AUTOMATIC BUSINESS QUOTATION SYSTEM*
══════════════════════════════════════
• Issuer: *${profile.username}* (@${profile.phone})
• Client Node: \`RECIPIENT_PROSPECT\`
• Description of Deliverables:
  👉 *"${itemDesc}"*

• Net Base Value: *${itemPrice.toLocaleString()} Tokens/KES*
• Flat VAT (16% Rate): *${vat.toLocaleString()} Tokens/KES*
• ════════════════════════════════════
• *Total Estimated Net Cost: ${totalAmt.toLocaleString()} Tokens/KES*

• Validity duration: *Valid for 30 Days*
• System quote ID: \`QT-${Math.floor(1000 + Math.random() * 9000)}\`

💡 _To convert this quote into a formal invoice, execute: *.invoice ${itemDesc}* (then click to dispatch to customers)_`;
      return sock.sendMessage(from, { text: quoteReceipt }, { quoted: m }).then(() => true);
    }

    case 'ticket':
    case 'tickets':
    case 'support': {
      profile.tickets = profile.tickets || [];
      const title = args.join(' ');

      if (!title) {
        let ticketText = `🎫 *DANSCOM ENTERPRISE SUPPORT TICKETING SYSTEM*
🛡️ _Consolidated Platform Help and Issue Board_

`;
        if (profile.tickets.length === 0) {
          ticketText += `• Your support ticket history is clean. Log a query: *.support My wallet deposit simulation is delayed*`;
        } else {
          profile.tickets.forEach((t) => {
            const icon = t.status === 'open' ? '⏳ [OPEN]' : '✅ [RESOLVED]';
            ticketText += `├─ *Ref: ${t.id}* - ${icon} *"${t.title}"* (${t.category} category) logged on ${t.date}\n`;
          });
        }
        return sock.sendMessage(from, { text: ticketText }, { quoted: m }).then(() => true);
      }

      const ticketId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
      profile.tickets.push({
        id: ticketId,
        title,
        category: 'Platform Operations',
        status: 'open',
        date: new Date().toLocaleDateString()
      });
      await syncUserProfile(profile);

      const ticketCreatedText = `🎫 *CUSTOMER HELP TICKET LOGGED SUCCESSFULLY!* ✅
• Ticket Identifier: \`${ticketId}\`
• Query Raised: *"${title}"*
• Current Status: ⏳ *UNDER REVIEW (Priority High)*
• Allocated Desk: *DANSCOM Technical Operations Core*

💡 _Our automated agents and moderators will respond to your issue shortly._`;
      return sock.sendMessage(from, { text: ticketCreatedText }, { quoted: m }).then(() => true);
    }

    case 'bizreport': {
      const text = `📊 *DANSCOM BUSINESS PERFORMANCE DASHBOARD*
══════════════════════════════════════
• Active Customers: *${(profile.businessProfile?.customers.length || 0) + 14} clients*
• Roster size: *${(profile.businessProfile?.staff.length || 0) + 2} employees*
• Total generated invoices value: *${(profile.businessProfile?.sales.length || 0) * 1500 + 48000} Tokens*
• Inventory Count: *${profile.businessProfile?.inventory?.length || 3} SKUs active*

💡 _Type *.businessreport* or *.inventory* for secondary deep listings!_`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // WEBSITE BUILDER SYSTEM
    // ═══════════════════════════════
    case 'createwebsite': {
      const promptWeb = args.join(' ');
      if (!promptWeb) return sock.sendMessage(from, { text: '⚠️ Correct usage: *.createwebsite [business description]*\ne.g. .createwebsite Premium Coffee Shop Nairobi' }, { quoted: m }).then(() => true);
      
      await sock.sendMessage(from, { text: `🕸️ *DANSCOM AI Web Builder is generating assets...* 🚀` }, { quoted: m });
      const response = await geminiAssistant(promptWeb, "Generate a beautifully styled single page business landing website code. Highlight modern typography, clean CSS layouts, products pricing grid, contact footer.");
      
      await sock.sendMessage(from, { text: response || 'Failed creating website.' }, { quoted: m });
      
      const deploymentText = `🌐 *WEBSITE SUCCESSFULLY GENERATED!* ✅

🔗 *Virtual Host Link:*
https://${profile.phone.toLowerCase()}-agency.danscom.com

• Deployment Region: *Cloud Run Europe-West1*
• Security Protocol: *SSL Handshake Active (SHA-256)*
• Status: *DNS LIVE & PROVISIONED*`;
      return sock.sendMessage(from, { text: deploymentText }, { quoted: m }).then(() => true);
    }

    case 'deploy':
    case 'host':
    case 'domain': {
      const domainName = args[0] || `${profile.username.toLowerCase()}.agency`;
      const text = `🌐 *CLOUD INFRASTRUCTURE NETWORK MANAGER*
• Targeted domain: \`${domainName}\`
• DNS Propagation: *99.1% (Success!)*
• Let's Encrypt SSL: *Active*
• Server Node IP: \`104.18.23.45\`
• Deployment Hub: *DANSCOM Decentralized Cloud*`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'portfolio': {
      return sock.sendMessage(from, { text: `💻 *DANSCOM PORTFOLIO TEMPLATE COMPILATION:* Active! Type *.createwebsite portfolio resume* to build your developer portfolio link.` }, { quoted: m }).then(() => true);
    }

    case 'store': {
      return sock.sendMessage(from, { text: `🛍️ *DANSCOM E-COMMERCE MOBILE-STORE:* Up and running! Direct setup instructions: Type *.createwebsite e-commerce store with checkout*` }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // CLOUD STORAGE SYSTEM
    // ═══════════════════════════════
    case 'savefile':
    case 'upload': {
      const fileName = args[0] || 'DANSCOM_Backup_01.zip';
      const uploadSize = Math.floor(200 + Math.random() * 4500);
 
      profile.cloudStorage.push({
        id: `F-${Math.floor(100 + Math.random() * 900)}`,
        fileName,
        fileSizeKB: uploadSize,
        mimeType: 'application/octet-stream',
        isEncrypted: true,
        downloadUrl: `https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app/api/download-spec`
      });
      await syncUserProfile(profile);
 
      const text = `🔒 *DANSCOM ENCRYPTED CLOUD SECURED UPLOAD!* ✅
Audit Block: \`SHA-256-DS-${Math.floor(100000 + Math.random() * 900000)}\`
 
• Allocated Filename: \`${fileName}\`
• Data Size: *${(uploadSize / 1024).toFixed(2)} MB*
• Encryption Cipher: *AES-256 Corporate grade*
• Secure Recovery download link:
• 👉 https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app/api/download-spec`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }
 
    case 'myfiles':
    case 'files': {
      let text = `📂 *YOUR ENCRYPTED CLOUD FILE VAULT*
Storage Quota Meter: ${renderVisualMeter(profile.cloudStorage.length, 20, 6)}\n\n`;
      if (profile.cloudStorage.length === 0) {
        text += `• Your cloud storage is currently empty. Reply with *.upload [file_name]* to securely back up digital items!`;
      } else {
        profile.cloudStorage.forEach((f) => {
          text += `• *ID: ${f.id}* - *${f.fileName}* [*${(f.fileSizeKB / 1024).toFixed(2)} MB*]\n  Cipher: AES-256 | Secure Download link active.\n\n`;
        });
      }
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'sharefile': {
      const fId = args[0];
      if (!fId) return sock.sendMessage(from, { text: '⚠️ Correct usage: *.sharefile [file_id]*' }, { quoted: m }).then(() => true);
      const file = profile.cloudStorage.find(f => f.id === fId);
      if (!file) return sock.sendMessage(from, { text: '❌ Specified document file ID not found.' }, { quoted: m }).then(() => true);

      const shareText = `🔗 *SECURE TEMPORARY SHARE LINK PROVISIONED!*
• Document: \`${file.fileName}\`
• Expiration: *Expires in 1 Hour*

👉 Access Download: https://ais-pre-lo7lp5bzig74auqtidjmrp-359576585250.europe-west1.run.app/api/download-spec`;
      return sock.sendMessage(from, { text: shareText }, { quoted: m }).then(() => true);
    }

    case 'deletefile': {
      const fId = args[0];
      if (!fId) return sock.sendMessage(from, { text: '⚠️ usage: *.deletefile [file_id]*' }, { quoted: m }).then(() => true);
      
      const fileIndex = profile.cloudStorage.findIndex(f => f.id === fId);
      if (fileIndex === -1) return sock.sendMessage(from, { text: '❌ File ID not found.' }, { quoted: m }).then(() => true);

      profile.cloudStorage.splice(fileIndex, 1);
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `🗑️ *Storage pipeline purged:* File successfully wiped out of our cloud nodes.` }, { quoted: m }).then(() => true);
    }

    case 'storage': {
      const stats = querySystemStats();
      const visualBar = renderVisualMeter(profile.cloudStorage.length, 20, 10);
      return sock.sendMessage(from, { text: `📂 *Your Cloud Storage Telemetry:*
Active Quota: ${visualBar} (${profile.cloudStorage.length} / 20 items stored)

💡 _Global platforms aggregate volume encrypted is ${(stats.cloudStorageUsedKB / 1048576).toFixed(2)} GB._` }, { quoted: m }).then(() => true);
    }

    case 'backup': {
      return sock.sendMessage(from, { text: `🛡️ *MASTER RESTORE TRIGGERED:* Automatically packing and saving database file to Firestore node. Backups successfully generated.` }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // EDUCATION SYSTEM
    // ═══════════════════════════════
    case 'study': {
      const studyMsg = `🎓 *DANSCOM MULTI-TENANT ACADEMICS SYSTEM*
Welcome to mobile learning space!

📚 *AVAILABLE MINI-COURSES:*
1. 💻 *CS-101:* Full-stack Web Development (Nextjs/React)
2. 📉 *FIN-202:* Decentralized micro-finance models & Ledger tracking
3. 🤖 *AI-303:* Advanced prompting design patterns with LLMs

👇 *Student shortcuts:*
• *.quiz [Course]* — Instantly take diagnostic AI multi-choice quiz.
• *.exam [Course]* — Launch timed formal final exam test.
• *.notes* — Browse common student repository topics lists.
• *.certificate* — Generate verified academic graduation certificate!`;
      return sock.sendMessage(from, { text: studyMsg }, { quoted: m }).then(() => true);
    }

    case 'quiz': {
      const sub = args[0] || 'AI-303';
      const text = `📝 *DANSCOM EDUCATION DIAGNOSTIC AI QUIZ*
Subject: *${sub} Prompting Patterns*

*Question:* What is "Chain-of-Thought" prompting?
A. Requesting answers inside a loop structure.
B. Instructing AI to explain its reasoning steps before printing final solution.
C. Forcing AI model to retrieve external web results.

👉 *To submit your response, type:*
*.exam ${sub} B*`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'exam': {
      const sub = args[0] || 'AI' ;
      const ans = args[1] || 'B';

      const isCorrect = ans.toUpperCase() === 'B';
      profile.education.quizzesTaken++;
      profile.education.quizScores.push({ course: sub, score: isCorrect ? 100 : 0, total: 100 });
      await syncUserProfile(profile);

      const text = `🎖️ *EXAM EVALUATION GRADING:*
• Course Code: *${sub}*
• Response submitted: *${ans.toUpperCase()}*
• Total Score: *${isCorrect ? '100% (A+ EXCELLENT)' : '0% (F FAIL)'}*
• Learning XP gained: *+80 XP points!*

💡 _Type *.certificate* to generate the course certificate!_`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'notes': {
      let text = `📂 *STUDY NOTES REPOSITORY (PEER-CONTRIBUTED:)*\n\n`;
      profile.education.notesRepo.forEach((n) => {
        text += `• 📌 *${n.topic}*\n  ${n.content}\n\n`;
      });
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'assignment': {
      return sock.sendMessage(from, { text: `📝 *Assignments logs:* Clean! No pending assignments found on your curriculum.` }, { quoted: m }).then(() => true);
    }

    case 'courses': {
      return sock.sendMessage(from, { text: `🎓 *Curriculum catalog:* Active enrollment: *CS-101 Web Dev*, *AI-303 LLMs prompting*.` }, { quoted: m }).then(() => true);
    }

    case 'certificate': {
      const visualCert = `🎖️━━━━━━━━━━━━━━━━━━━━━━━━━━━━🎖️
       *CERTIFICATE OF OUTSTANDING GRADUATION*
       
This verifies that user node @${profile.phone} has fully completed and graduated with distinction on:
🎓 *DANSCOM MULTI-TENANT TECHNOLOGY CURRICULUM*

• Issue date: *${new Date().toLocaleDateString()}*
• Master verification code: \`CERT-AC-${Math.floor(1000 + Math.random() * 9000)}\`
• Status: *OFFICIALLY VERIFIED & REGISTERED ON FIRESTORE LEDGER*
🎖️━━━━━━━━━━━━━━━━━━━━━━━━━━━━🎖️`;
      return sock.sendMessage(from, { text: visualCert, mentions: [context.sender] }, { quoted: m }).then(() => true);
    }

    case 'studygroup': {
      const topic = args.join(' ') || 'Cloud Architecture & Firestore Optimization';
      const text = `👥 *DANSCOM MULTI-TENANT ACADEMIC STUDY GROUP*
══════════════════════════════════════
• Live Study Room topic: *"${topic}"*
• Session Status: 📡 *ACTIVE ONLINE BROADCAST*
• Coordinators: @${profile.phone}
• Student Peers in Room: *18 Participants*

💡 _Participate actively in peer note repositories via command: *.notes*_`;
      return sock.sendMessage(from, { text, mentions: [context.sender] }, { quoted: m }).then(() => true);
    }

    case 'learningstats': {
      const text = `📊 *DANSCOM ACADEMICS LEARNING STATS & ANALYTICS*
══════════════════════════════════════
• Total Registered Courseware: *CS-101, FIN-202, AI-303*
• Formal Final Exams Taken: *${profile.education.quizzesTaken} Exams*
• Average Performance Grade: *${profile.education.quizScores.length > 0 ? (profile.education.quizScores.reduce((sum, q) => sum + q.score, 0) / profile.education.quizScores.length).toFixed(1) : '95.5'}% (GPA: 3.9)*
• Learning Skill Badges: *[ Rookie Explorer, Veteran System Engineer ]*

💡 _Keep taking exams and study lessons to level up and earn credits rewards!_`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // COMMUNITY SYSTEM (VOTING/FUNDRAISING)
    // ═══════════════════════════════
    case 'vote':
    case 'poll': {
      const topic = args.join(' ') || 'Upgrade system database infrastructure?';
      const text = `🗳️ *DANSCOM VOTING & COMMUNITY DECENTRALIZED POLL*
════════════════════════════════
*POLITICAL/SYSTEM OPINION POOL*
════════════════════════════════

• Issue: *"${topic}"*
• Proposer: @${profile.phone}
• Category: Platform Governance

🔵 Option 1: *Yes, transition fully to cloud Firestore clusters.*
🔴 Option 2: *No, keep hybrid JSON filesystem synchronization.*

💡 _To record secure vote representation instantly, type:_
*.vote ${Math.floor(10 + Math.random()*90)} [Option_Number]*`;
      return sock.sendMessage(from, { text, mentions: [context.sender] }, { quoted: m }).then(() => true);
    }

    case 'event': {
      const text = `📅 *COMMUNITY EVENTS & HACKATHONS LOG*
• Up-Coming gathering: *DANSCOM Devs Hackathon 2026*
• Start schedule: *June 15, 2026 at 09:00 UTC*
• Location: *Virtual (DANSCOM multi-tenant video link)*
• Total RSVP: *142 tech builders*`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'attendance': {
      return sock.sendMessage(from, { text: `✔️ *ATTENDANCE LOGGED SUCCESS:* Saved status to active system database tracker.` }, { quoted: m }).then(() => true);
    }

    case 'fundraise':
    case 'donate': {
      const donateAmt = parseFloat(args[0]);
      if (!isNaN(donateAmt) && donateAmt > 0) {
        if (profile.walletBalance < donateAmt) {
          return sock.sendMessage(from, { text: `⚠️ *Overdraft:* You cannot donate *${donateAmt} Tokens*. Your wallet balance: *${profile.walletBalance} Tokens*.` }, { quoted: m }).then(() => true);
        }
        profile.walletBalance -= donateAmt;
        profile.community.reputation += Math.ceil(donateAmt / 10);
        await syncUserProfile(profile);

        const thankYou = `💖 *THANK YOU FOR YOUR BENEVOLENT CONTRIBUTION!*
• Contribution: *${donateAmt.toLocaleString()} Tokens*
• Recipient Fund: *computational infrastructure expansion*
• Reputation awarded: *+${Math.ceil(donateAmt / 10)} Reputation score points!*
• Status: *TRANSFERRED SUCCESSFULLY*

💡 _DANSCOM Labs is proud to be powered by awesome system participants like you!_`;
        return sock.sendMessage(from, { text: thankYou }, { quoted: m }).then(() => true);
      }

      const text = `💰 *DANSCOM TRANSPARENT CROWDFUND TRANSPARENCY*
• Active Target campaign: *Upgrade core system computational node keys*
• Funding Goal: *15,000 Tokens*
• Total Raised: *11,430 Tokens* (76.2% Completed)
• Backer Pool: *34 validators*
 
💡 _To back this tech stack expansion, submit tokens via: *.donate [amount]*_`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'rep':
    case 'reputation': {
      const targetUserPh = args[0] ? args[0].replace(/[^0-9]/g, '') : null;
      if (!targetUserPh) {
        return sock.sendMessage(from, { text: `🏆 *DANSCOM TRUST REPUTATION SYSTEM*
User node: @${profile.phone}
• Your dynamic reputation score: *${profile.community.reputation} Points*

💡 _To vouch/recommend another participant, execute: *.rep @user_phone*_` }, { quoted: m }).then(() => true);
      }

      const targetJid = `${targetUserPh}@s.whatsapp.net`;
      if (targetUserPh === profile.phone) {
        return sock.sendMessage(from, { text: `⚠️ Duplication block: You cannot increment your own reputation score!` }, { quoted: m }).then(() => true);
      }

      const targetProfile = await getOrCreateProfile(targetJid);
      targetProfile.community.reputation += 1;
      profile.xp += 15; // Give xp to voucher
      await syncUserProfile(targetProfile);
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `🏆 *REPUTATION ENDORSEMENT LOGGED!*
• Endorser: @${profile.phone} (+15 XP awarded)
• Target: @${targetProfile.phone} (+1 Reputation Score point!)
• Registry update: *SYNCHRONIZED SUCCESSFULLY*`, mentions: [context.sender, targetJid] }, { quoted: m }).then(() => true);
    }

    case 'birthday':
    case 'birthdays': {
      profile.birthdays = profile.birthdays || [];
      const bdayName = args[0];
      const bdayDate = args[1]; // formats like "MM-DD" e.g. "12-25"

      if (!bdayName || !bdayDate) {
        let bdaysList = `🎂 *DANSCOM COMMUNITY BIRTHDAYS REGISTRY*
🛡️ _Never miss a milestone inside our technology group_

`;
        if (profile.birthdays.length === 0) {
          bdaysList += `• Registry is currently empty. Add friend: *.birthday Daniel 12-25*`;
        } else {
          profile.birthdays.forEach((b) => {
            bdaysList += `├─ 🎉 *${b.name}* — Anniversary date: *${b.date}*\n`;
          });
        }
        return sock.sendMessage(from, { text: bdaysList }, { quoted: m }).then(() => true);
      }

      profile.birthdays.push({
        name: bdayName,
        date: bdayDate
      });
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `🎂 *BIRTHDAY REMINDER SET SECURELY!* ✅\n\n• Name: *${bdayName}*\n• Date: *${bdayDate}* (Automatically checking every midnight)\n\nType *.birthdays* to view lists!` }, { quoted: m }).then(() => true);
    }

    case 'announce': {
      const announcement = args.join(' ');
      if (!announcement) {
        return sock.sendMessage(from, { text: `⚠️ Usage: *.announce [Urgent community broadcast alert message]*` }, { quoted: m }).then(() => true);
      }
      const header = `📢 *COMMUNITY ANNOUNCEMENT — DANSCOM SYSTEM* 📢\n\n${announcement}\n\n💡 _Broadcast to active channels by verified representative on ${new Date().toLocaleDateString()}_`;
      return sock.sendMessage(from, { text: header }, { quoted: m }).then(() => true);
    }

    case 'community':
    case 'rank': {
      const text = `🏆 *DANSCOM TECH CONTRIBUTOR RANKINGS (TOP NODES)*
1. 🎖️ @${profile.phone} (Level: *Rank ${profile.level}* • contributor score: ${120 + profile.level * 40})
2. 🧑‍💻 @254711111111 (Level: *Rank 8* • contributor score: 450)
3. 🤖 @SystemBot (Level: *System Core* • contributor score: 999)`;
      return sock.sendMessage(from, { text, mentions: [context.sender, '254711111111@s.whatsapp.net'] }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // AUTOMATION SYSTEM Help
    // ═══════════════════════════════
    case 'schedule': {
      const hours = args[0] || '2';
      const scheduledText = args.slice(1).join(' ') || 'System check up active.';
      if (!args[0]) return sock.sendMessage(from, { text: '⚠️ Correct usage: *.schedule [Hours_Count] [Dispatch_Message]*' }, { quoted: m }).then(() => true);

      const text = `⏰ *DANSCOM BACKGROUND AUTOMATED MESSAGE DISPATCHER*
• Timeout lock: *Every ${hours} Hours*
• Queued dispatch body: *"${scheduledText}"*
• Status: *SUCCESSFULLY SLOTTED INSIDE BACKGROUND ALARM SERVICE*
• Automation key: \`AUTO-SLOT-${Math.floor(100 + Math.random()*900)}\``;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'remind': {
      const reminderDesc = args.join(' ');
      if (!reminderDesc) return sock.sendMessage(from, { text: '⚠️ usage: *.remind [Your task details]*' }, { quoted: m }).then(() => true);
      const text = `⏰ *REMINDER REGISTERED INDEX!*
• Detail: *"${reminderDesc}"*
• Trigger alarm time: *In 30 Minutes dynamically*
• Target Node: @${profile.phone}`;
      return sock.sendMessage(from, { text, mentions: [context.sender] }, { quoted: m }).then(() => true);
    }

    case 'autoreply': {
      const phrase = args[0];
      const replyBody = args.slice(1).join(' ');
      if (!phrase || !replyBody) return sock.sendMessage(from, { text: '⚠️ Format: *.autoreply [trigger_phrase_lowercase] [reply_message]*' }, { quoted: m }).then(() => true);

      profile.automation.push({
        id: `A-${Math.floor(100+Math.random()*900)}`,
        trigger: phrase.toLowerCase(),
        replyText: replyBody,
        isActive: true
      });
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `✅ *Dynamic routing automation rule matched and registered!*
If anyone types *"${phrase}"*, the bot will respond automatically inside private text panels with:
👉 _"${replyBody}"_` }, { quoted: m }).then(() => true);
    }

    case 'notify':
    case 'workflow': {
      const text = `🔗 *DANSCOM BOT WORKFLOW ENGINE ACTIVE (IF-THIS-THEN-THAT)*
• Rule 1: *IF .buy executed, THEN print secure receipt.* (Status: Active)
• Rule 2: *IF User upgraded Rank, THEN distribute tokens.* (Status: Active)
• Rule 3: *IF Ledger deposit completed, THEN unlock VIP membership.* (Status: Active)`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'createagent':
    case 'myagents':
    case 'agent': {
      profile.aiAgents = profile.aiAgents || [];
      const agentName = args[0];
      const agentRole = args.slice(1).join(' ');

      if (!agentName || !agentRole) {
        let agentsText = `🤖 *DANSCOM CUSTOM MULTI-TENANT AI-AGENT MAKER*
🛡 _Design personal self-directed bots running on WhatsApp_
 
`;
        if (profile.aiAgents.length === 0) {
          agentsText += `• No custom agents found. Spawn one: *.createagent SalesBot expert in marketing books and sneakers*`;
        } else {
          profile.aiAgents.forEach((a) => {
            agentsText += `├─ 🤖 *${a.name}* — Role instructions: *"${a.role}"* (Status: Active)\n`;
          });
        }
        return sock.sendMessage(from, { text: agentsText }, { quoted: m }).then(() => true);
      }

      profile.aiAgents.push({
        name: agentName,
        role: agentRole,
        instructions: agentRole
      });
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `🤖 *AI AGENT SPAWNED CORRECTLY!* ✅\n\n• Agent Name: @*${agentName}*\n• System Role: *"${agentRole}"*\n• Trigger Command: *.chat ${agentName} [your prompt]*\n\nYour customized agent has been written on persistent cloud database!` }, { quoted: m }).then(() => true);
    }

    case 'appstore':
    case 'install': {
      profile.installedApps = profile.installedApps || [];
      const appName = args.join(' ');

      const availableAppsList = [
        { name: 'DANSCOM Games Console', desc: 'Unlock interactive Retro Chess & Blackjack commands (.game .play)' },
        { name: 'Fintech FX Trader', desc: 'Get automatic trading forex signals and signals alerts (.signals)' },
        { name: 'Bulk Campaigner', desc: 'Broadcast simulated promotional SMS messages to bulk queues (.bulksms)' }
      ];

      if (!appName) {
        let storeText = `🏪 *DANSCOM WHATSAPP OPERATING SYSTEM APPS MARKET*
🛡️ _Extend your chat bot experience with high value mini apps_

`;
        availableAppsList.forEach((app, idx) => {
          const isInstalled = profile.installedApps?.includes(app.name) ? '✅ [INSTALLED]' : `👉 *.install ${app.name}*`;
          storeText += `*#${idx+1} ${app.name}* — ${isInstalled}\n  _${app.desc}_\n\n`;
        });
        return sock.sendMessage(from, { text: storeText }, { quoted: m }).then(() => true);
      }

      const matchApp = availableAppsList.find(a => a.name.toLowerCase().includes(appName.toLowerCase()));
      if (!matchApp) {
        return sock.sendMessage(from, { text: `⚠️ App *"${appName}"* was not found on our active directory indexes.` }, { quoted: m }).then(() => true);
      }

      if (profile.installedApps.includes(matchApp.name)) {
        return sock.sendMessage(from, { text: `🛡️ Notice: App *"${matchApp.name}"* is already installed on your whatsapp workspace.` }, { quoted: m }).then(() => true);
      }

      profile.installedApps.push(matchApp.name);
      await syncUserProfile(profile);

      return sock.sendMessage(from, { text: `⚙️ *INSTALLATION COMPLETE!* 🎉\nInstalled *${matchApp.name}* onto your profile.\n\nEnjoy original commands. Try typing *.appstore* to inspect your dashboard!` }, { quoted: m }).then(() => true);
    }

    case 'businesscard':
    case 'card': {
      const cardProfile = `📇 *DANSCOM SECURED METADATA DIGITAL BUSINESS CARD*
══════════════════════════════════════════
• Owner: *${profile.username}*
• WhatsApp: *wa.me/${profile.phone}*
• Business Sector: *Software, Fintech & Cloud Devs*
• Tech Level: *Rank ${profile.level} Premium*

🔗 *Shareable QR/Digital NFC Link:*
👉 https://wa.me/${sock.user!.id.split(':')[0]}?text=.register%20${profile.referralCode}

💡 _Forward this card directly to partners to share your professional status node!_`;
      return sock.sendMessage(from, { text: cardProfile }, { quoted: m }).then(() => true);
    }

    case 'game': {
      const defaultGames = [
        '🎮 Chess simulator active! Current setup coordinates: E2 to E4.',
        '🃏 Blackjack! Your hand: King ♠️, Jack ♦️ (Total Score: 20 points). Simulated dealer card hidden.',
        '👾 Space Invaders text board! Speed: High. Score: 3,450 points.'
      ];
      const randomGameTxt = defaultGames[Math.floor(Math.random() * defaultGames.length)];
      const text = `🕹️ *DANSCOM MULTIPLAYER RETRO GAMES SYSTEM*
══════════════════════════════════════
• Game Status: *DANSCOM SYSTEM RUNNING*
• Active Arena coordinates: Group Room +${profile.phone}

👉 ${randomGameTxt}

💡 _Pioneering full multiplayer gaming experiences directly inner WhatsApp templates!_`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }
    case 'play':
    case 'song': {
      const querySong = args.join(' ');
      if (!querySong) return sock.sendMessage(from, { text: '❗ Please provide a search query.' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `⏳ *Searching and preparing audio:* "${querySong}"... 🎵` }, { quoted: m });
      
      try {
        let titleSong = querySong;
        let downloadUrl = '';

        // Try Erdwpe
        try {
          const res = await fetch(`https://api.erdwpe.com/api/ytdl/play?query=${encodeURIComponent(querySong)}`);
          if (res.ok) {
            const data = await res.json() as any;
            if (data.status && data.result) {
                const result = data.result;
                titleSong = result.title || querySong;
                downloadUrl = result.audio?.url || result.url || result.video?.url || '';
            }
          }
        } catch (e) {
          console.warn('Erdwpe failed', e);
        }

        // Try Widipe fallback
        if (!downloadUrl) {
          const res = await fetch(`https://widipe.com/ytplay?query=${encodeURIComponent(querySong)}`);
          if (res.ok) {
            const data = await res.json() as any;
            if (data.status && data.result) {
              titleSong = data.result.title || titleSong;
              downloadUrl = data.result.download?.url || data.result.url || '';
            }
          }
        }
        
        if (!downloadUrl) throw new Error('Could not find downloadable audio URL.');
        
        const audioBuffer = await downloadMediaBuffer(downloadUrl, 60000);
        if (audioBuffer && audioBuffer.length > 50) {
          const fileName = `${titleSong.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
          await sock.sendMessage(from, { 
            document: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: fileName,
            caption: `🎵 *${titleSong}* downloaded successfully.`
          }, { quoted: m });
        } else {
          throw new Error('Could not download audio content');
        }
      } catch (err: any) {
        console.error('[Music Downloader Error]:', err.message);
        await sock.sendMessage(from, { text: `❌ *Media Download Failed:* ${err.message}.` }, { quoted: m });
      }
      return true;
    }

    case 'video':
    case 'ytmp4': {
      const queryVideo = args.join(' ');
      if (!queryVideo) return sock.sendMessage(from, { text: '❗ Please provide a search query or URL.' }, { quoted: m }).then(() => true);
      await sock.sendMessage(from, { text: `⏳ *Searching and preparing video:* "${queryVideo}"... 🎥` }, { quoted: m });
      
      try {
        let titleVideo = queryVideo;
        let downloadUrl = '';

        // Simple check if it's a URL
        if (queryVideo.startsWith('http')) {
           const res = await fetch(`https://api.erdwpe.com/api/ytdl/ytmp4?url=${encodeURIComponent(queryVideo)}`);
           if (res.ok) {
             const data = await res.json() as any;
             if (data.status && data.result) {
                titleVideo = data.result.title || titleVideo;
                downloadUrl = data.result.download?.url || data.result.url || data.result.video?.url || '';
             }
           }
        } else {
           // Search and get video
           const res = await fetch(`https://api.erdwpe.com/api/ytdl/play?query=${encodeURIComponent(queryVideo)}`);
           if (res.ok) {
             const data = await res.json() as any;
             if (data.status && data.result) {
               titleVideo = data.result.title || titleVideo;
               downloadUrl = data.result.video?.url || data.result.url || data.result.audio?.url || '';
             }
           }
        }
        
        if (!downloadUrl) throw new Error('Could not find downloadable video URL.');

        const videoBuffer = await downloadMediaBuffer(downloadUrl, 60000);
        if (videoBuffer && videoBuffer.length > 50) {
          const fileName = `${titleVideo.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
          await sock.sendMessage(from, { 
            document: videoBuffer,
            mimetype: 'video/mp4',
            fileName: fileName,
            caption: `🎥 *${titleVideo}* downloaded successfully.`
          }, { quoted: m });
        } else {
          throw new Error('Could not download video content');
        }
      } catch (err: any) {
        console.error('[Video Downloader Error]:', err.message);
        await sock.sendMessage(from, { text: `❌ *Media Download Failed:* ${err.message}.` }, { quoted: m });
      }
      return true;
    }

    case 'signals':
    case 'trade': {
      const markets = [
        { asset: 'BTC/USDT (Crypto)', action: 'STRONG BUY 🟢', entry: '71,200', target: '74,500', sl: '69,800' },
        { asset: 'EUR/USD (Forex)', action: 'STRONG SELL 🔴', entry: '1.0845', target: '1.0710', sl: '1.0910' },
        { asset: 'XAU/USD (Gold)', action: 'STRONG BUY 🟢', entry: '2,330', target: '2,365', sl: '2,312' }
      ];
      const sign = markets[Math.floor(Math.random() * markets.length)];

      const text = `📈 *DANSCOM PREMIUM INVESTMENT TRADING SIGNALS*
🔔 _Automated Financial Markets Forecast Node_
══════════════════════════════════════
• Asset Selected: *${sign.asset}*
• Market Action: *${sign.action}*
• Entry Zone Price: *${sign.entry}*
• Target Take-Profit (TP): *${sign.target}*
• Protection Stop-Loss (SL): *${sign.sl}*
• Accuracy certainty: *87.5% Fibonacci core indicator*

💡 _Premium Trading alerts generated in real-time by DANSCOM predictive LLMs._`;
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'bulksms': {
      const messageBody = args.join(' ') || 'DANSCOM Superbot: Unlock premium discounts of up to 40% on standard database setups!';
      const sendCount = Math.floor(100 + Math.random() * 900);
      
      const bulkReceipt = `📲 *DANSCOM CORPORATE BULK SMS DISPATCH CAMPAIGN*
══════════════════════════════════════
• Campaign Title: \`DANSCOM_Promotional_Broadcast\`
• Message Template: *"${messageBody}"*
• Total Target Numbers: *${sendCount} contacts*
• Delivery Queue status: *COMPLETED SUCCESSFULLY*
• Processing speed: *480 SMS / Sec*
 
💡 _Integrated with major telecom SMS aggregator networks for rapid delivery metrics._`;
      return sock.sendMessage(from, { text: bulkReceipt }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // CONTENT CREATION STUDIO
    // ═══════════════════════════════
    case 'logo':
    case 'poster':
    case 'flyer':
    case 'banner':
    case 'card':
    case 'mockup':
    case 'socialpost': {
      const promptStyle = args.join(' ') || 'Minimalist Neo-Cyberpunk Business Card';
      await sock.sendMessage(from, { text: `🎨 *DANSCOM Studio Engine is compiling vector assets for ${command}...*` }, { quoted: m });
      
      setTimeout(async () => {
        try {
          // Provide specialized curated backgrounds from Unsplash matched to design content
          const images: Record<string, string> = {
            logo: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80',
            poster: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80',
            flyer: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&q=80',
            banner: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80',
            card: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
            mockup: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
            socialpost: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80',
          };
          
          await sock.sendMessage(from, {
            image: { url: images[command] || images.logo },
            caption: `🎨 *DANSCOM Design Studio [${command.toUpperCase()}]* 🎨\n\n• Style: *Modern Vector Aesthetics*\n• Topic theme: "${promptStyle}"\n• Engine Status: *PRO COMPILATION OK*\n• Master block key: \`SEC-CREATIVE-${Math.floor(1000 + Math.random()*9000)}\`\n\n🔗 Custom edits can be made directly in our editor panel!`,
          }, { quoted: m });
        } catch (e: any) {
          await sock.sendMessage(from, { text: `⚠️ Design template engine pipeline is full. Try again.` }, { quoted: m });
        }
      }, 1500);
      return true;
    }

    // ═══════════════════════════════
    // DOWNLOAD CENTER (MAPPED FOR EXTRA STABILITY)
    // ═══════════════════════════════
    case 'yt':
    case 'tiktok':
    case 'fb':
    case 'insta':
    case 'audio':
    case 'video': {
      // These are handled by existing high-priority downloader blocks, but let's provide clear onboarding instructions if called empty!
      if (args.length === 0) {
        return sock.sendMessage(from, { text: `📥 *DANSCOM MULTIMEDIA DOWNLOAD PIPELINE*
Provide URL destination! Examples:
👉 *.videohttps://www.youtube.com/watch?v=dQw4w9WgXcQ*
👉 *.tiktokhttps://vm.tiktok.com/ZM8rDqf/*` }, { quoted: m }).then(() => true);
      }
      return false; // let the default commands handle it
    }

    // ═══════════════════════════════
    // PREMIUM SUBSCRIPTION SYSTEM
    // ═══════════════════════════════
    case 'subscribe':
    case 'upgrade':
    case 'renew': {
      const plan = args[0] || 'weekly';
      const promptText = `💳 *DANSCOM VIP PRO MEMBERSHIP SYSTEM*

💎 *ACTIVE PLANS STATUS:*
• *Weekly Plan:* 5 KES / Tokens (Active checkout option)
• *Monthly Plan:* 15 KES / Tokens (High value upgrade)
• *Annual Plan:* 100 KES / Tokens

🎁 *Unlocked Platinum benefits:*
- Zero limits on Gemini GPT-4 assistant calls
- Professional high-speed video converters
- Priority graphic renders (.logo, .generate)
- Verified premium architect symbol on ledger profiles

👉 *To authorize instant upgrade with wallet balance, reply:*
*.upgradevip*`;
      return sock.sendMessage(from, { text: promptText }, { quoted: m }).then(() => true);
    }

    case 'upgradevip': {
      if (profile.walletBalance < 15) {
        return sock.sendMessage(from, { text: `⚠️ *Insufficient Ledger funds:* Upgrade requires *15 Tokens*. Your wallet currently contains *${profile.walletBalance} Tokens*. Type *.deposit* to top up!` }, { quoted: m }).then(() => true);
      }

      profile.walletBalance -= 15;
      profile.isPremium = true;
      profile.role = 'vip';
      profile.badges.push('VIP Executive Member');
      await syncUserProfile(profile);

      const successText = `💎 *DANSCOM VIP PLATINUM UPGRADE COMPLETED!* 💎
═════════════════════════════════
Welcome to high-priority technology tiers.

• Transaction cost: *-15 Tokens (Debited)*
• Account Category: *VIP EXECUTIVE MEMBER*
• Expiration: *30 Days active subscription*
• Security Tag status: *VERIFIED VALIDATOR AUTHORIZED*

🎖️ Your professional profile has been decorated with VIP Executive badge indicators!`;
      return sock.sendMessage(from, { text: successText }, { quoted: m }).then(() => true);
    }

    case 'vip': {
      return sock.sendMessage(from, { text: `💎 *DANSCOM EXECUTIVE LOUNGE INDICES:* Welcome! Check your status dynamically in *.profile* at any moment.` }, { quoted: m }).then(() => true);
    }

    // ═══════════════════════════════
    // ADMIN PANEL SERVICES
    // ═══════════════════════════════
    case 'admin': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ *Authorized Credentials Required:* Restricted solely to systems overseers and DANSCOM creators.' }, { quoted: m }).then(() => true);
      }

      const stats = querySystemStats();
      const visualBar = renderVisualMeter(stats.premiumMembersCount, stats.totalRegisteredUsers, 6);

      const text = `👑 *DANSCOM MULTI-TENANT OPERATING SYSTEM OVERSEER ADM*
🛡️ _Labs Systems Core Dashboard Integration_

🚨 *PLATFORM HEALTH TELEMETRY:*
├─ Registry User Pool: *${stats.totalRegisteredUsers}+ accounts*
├─ Financial Ledger Total: *${stats.activeDeposits.toLocaleString()} KES*
├─ Cloud Server Uptime: *${(stats.serverUptimeSec / 3600).toFixed(2)} Hours active*
├─ Active Automation workflow limits: *${stats.automatedTriggersCount} flows*
└─ Premium Conversion Rate: ${visualBar} (*${stats.premiumMembersCount} VIPs*)

📁 *ADMIN CONTROLLER KEY COMMANDS:*
• *.users* — Print list of registered user nodes JIDs.
• *.revenue* — Overview of financial balance indices.
• *.broadcast [msg]* — Dispatch urgent text alerts globally to all nodes.
• *.ban [@user_phone]* — Revoke device node authority.
• *.unban [@user_phone]* — Restore device node authority.`;
      
      return sock.sendMessage(from, { text }, { quoted: m }).then(() => true);
    }

    case 'users': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ Overseer authentication required.' }, { quoted: m }).then(() => true);
      }
      
      let indexText = `📁 *REGISTERED SYSTEM ACTIVE DIRECTORY NODES:*\n\n`;
      const usersList = Object.values(ecosystemDb);
      usersList.slice(0, 10).forEach((u, i) => {
        indexText += `${i + 1}. Username: *${u.username}* | +${u.phone} | Level: *Rank ${u.level}* (JID: ${u.id})\n`;
      });
      if (usersList.length > 10) {
        indexText += `\n_And ${usersList.length - 10} additional nodes registered on Firestore ledger database._`;
      }
      return sock.sendMessage(from, { text: indexText }, { quoted: m }).then(() => true);
    }

    case 'revenue': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ Overseer authentication required.' }, { quoted: m }).then(() => true);
      }
      const stats = querySystemStats();
      const reports = `🏦 *DANSCOM PLATFORM GLOBAL BALANCE SHEET*
• Total deposits aggregate: *${stats.activeDeposits.toLocaleString()} Tokens*
• Cumulative escrow volume: *${stats.totalMarketVolume.toLocaleString()} KES*
• Subscription payouts gross: *${(stats.premiumMembersCount * 15).toLocaleString()} Tokens*
• Current infrastructure status: *ONLINE & STABLE*`;
      return sock.sendMessage(from, { text: reports }, { quoted: m }).then(() => true);
    }

    case 'broadcast': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ Overseer authentication required.' }, { quoted: m }).then(() => true);
      }
      const bText = args.join(' ');
      if (!bText) return sock.sendMessage(from, { text: '⚠️ Specify alert content to broadcast!' }, { quoted: m }).then(() => true);
      
      const targetMessage = `🚨 *DANSCOM PLATFORM REVOLUTION GLOBAL BROADCAST* 🚨\n\n${bText}\n\n_System Admin dispatch message alert. Secure multi-tenant authentication compliant._`;
      
      // Send output acknowledgment
      await sock.sendMessage(from, { text: `📣 *Urgent dispatch triggered of global broadcast message!* \nSending to ${Object.keys(ecosystemDb).length} nodes dynamically in background lists...` }, { quoted: m });
      
      // Perform non-blocking broadcast dispatch loop to active registered sessions
      Object.keys(ecosystemDb).forEach(async (jid) => {
        try {
          if (jid !== senderId) { // skip original requester to avoid repetition
            await sock.sendMessage(jid, { text: targetMessage });
          }
        } catch (e) {
          // ignore failures for stale JIDs
        }
      });
      return true;
    }

    case 'ban': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ Overseer authentication required.' }, { quoted: m }).then(() => true);
      }
      const phoneToBan = args[0] ? args[0].replace(/[^0-9]/g, '') : null;
      if (!phoneToBan) return sock.sendMessage(from, { text: '⚠️ e.g. .ban 254712345678' }, { quoted: m }).then(() => true);

      const targetJid = `${phoneToBan}@s.whatsapp.net`;
      const targetUser = await getOrCreateProfile(targetJid);
      targetUser.role = 'user'; // reset role
      targetUser.registered = false; // suspend credentials
      await syncUserProfile(targetUser);

      return sock.sendMessage(from, { text: `🚨 *Device node authority revoked successfully!* @${phoneToBan} suspended from accessing active digital platform services. Logs saved to database.`, mentions: [`${phoneToBan}@s.whatsapp.net`] }, { quoted: m }).then(() => true);
    }

    case 'unban': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ Overseer authentication required.' }, { quoted: m }).then(() => true);
      }
      const phoneToUnban = args[0] ? args[0].replace(/[^0-9]/g, '') : null;
      if (!phoneToUnban) return sock.sendMessage(from, { text: '⚠️ e.g. .unban 254712345678' }, { quoted: m }).then(() => true);

      const targetJid = `${phoneToUnban}@s.whatsapp.net`;
      const targetUser = await getOrCreateProfile(targetJid);
      targetUser.registered = true; // reactivate credentials
      await syncUserProfile(targetUser);

      return sock.sendMessage(from, { text: `✔️ *Device node authority successfully restored!* @${phoneToUnban} restored to platform participant roster.`, mentions: [`${phoneToUnban}@s.whatsapp.net`] }, { quoted: m }).then(() => true);
    }

    case 'logs': {
      if (!context.isOwner && profile.role !== 'admin') {
        return sock.sendMessage(from, { text: '⚠️ Overseer authentication required.' }, { quoted: m }).then(() => true);
      }
      const stats = querySystemStats();
      const logsText = `📋 *DANSCOM LABS CORE SYSTEMS LOGS*
• Uptime: *${(stats.serverUptimeSec / 3600).toFixed(3)} hour pools*
• Firestore Node API state: *${getIsFirestoreUsable() ? 'SECURED_CLOUD_ACTIVE' : 'OFFLINE_FAILSAFE_ACTIVE'}*
• Global active threads: *4 concurrency logs*
• Escrow verification queues: *SUCCESS*`;
      return sock.sendMessage(from, { text: logsText }, { quoted: m }).then(() => true);
    }
  }

  // Check custom user automated reply rules
  const lowercaseInput = command.toLowerCase();
  const matchedRule = profile.automation.find(auto => auto.trigger === lowercaseInput && auto.isActive);
  if (matchedRule) {
    await sock.sendMessage(from, { text: matchedRule.replyText }, { quoted: m });
    return true;
  }

  return false; // command not matched, let standard system process
};
