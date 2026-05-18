import { GoogleGenAI } from "@google/genai";
import { config } from '../config/index.js';

const genAI = new GoogleGenAI({
  apiKey: config.geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const geminiAssistant = async (prompt: string, systemInstruction?: string) => {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "You are a helpful WhatsApp assistant bot. Be concise and friendly.",
      },
    });
    return response.text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
};

export const generateImageDescription = async (imageUrl: string) => {
    // Logic for multimodality if needed
    return null;
}
