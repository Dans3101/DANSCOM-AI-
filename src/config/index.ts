import dotenv from 'dotenv';
dotenv.config();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  bot: {
    ownerNumber: process.env.OWNER_NUMBER || '',
    prefix: process.env.PREFIX || '.',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};
