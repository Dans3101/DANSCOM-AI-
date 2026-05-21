import dotenv from 'dotenv';
dotenv.config();

const parsePrivateKey = (key: string | undefined): string => {
  if (!key) return '';
  let cleanKey = key.trim();
  // Strip enclosing quotes if added by the Hosting Platform UI
  if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
    cleanKey = cleanKey.slice(1, -1);
  } else if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
    cleanKey = cleanKey.slice(1, -1);
  }
  
  // Convert literal \n escapes to real newlines
  cleanKey = cleanKey.replace(/\\n/g, '\n').trim();
  
  // If a swallowed backslash in a leading \n left a stray 'n' before 'MII', strip it
  if (cleanKey.startsWith('nMII')) {
    cleanKey = cleanKey.slice(1);
  }
  
  // Wrap in standard PEM headers if they are missing
  if (!cleanKey.startsWith('-----')) {
    cleanKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;
  }
  
  return cleanKey;
};

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  bot: {
    ownerNumber: process.env.OWNER_NUMBER || '',
    prefix: process.env.PREFIX || '.',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};
