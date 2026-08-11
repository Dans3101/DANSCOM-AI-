import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
import axios from 'axios';

/**
 * Gemini model
 *
 * Using a current Gemini Flash model compatible with
 * the @google/genai SDK.
 */
const MODEL_NAME = 'gemini-2.5-flash';

// Initialize Gemini client
const client = new GoogleGenAI({
    apiKey: config.geminiApiKey
});

/**
 * Circuit Breaker State
 */
let isDailyQuotaExhausted = false;
let quotaResetTimeout: NodeJS.Timeout | null = null;

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

const FALLBACK_MESSAGE =
    "⚠️ The AI service has reached its usage limit. Please try again later.";

/**
 * Safely execute Gemini API calls
 */
async function safeExecute(
    apiCall: () => Promise<any>,
    retryCount = 0
): Promise<string> {

    // Circuit breaker
    if (isDailyQuotaExhausted) {
        return FALLBACK_MESSAGE;
    }

    try {
        const response = await apiCall();

        // Gemini response text
        if (response?.text) {
            return response.text;
        }

        return "I'm sorry, I couldn't generate a response.";
    } catch (error: any) {

        const status = error?.status || error?.code || 0;
        const message = String(
            error?.message || error || ''
        );

        const lowerMessage = message.toLowerCase();

        console.error(
            `[Gemini] API Error (${status}):`,
            message
        );

        /**
         * 404 - Model not found / unsupported model
         */
        if (
            status === 404 ||
            lowerMessage.includes('model') &&
            (
                lowerMessage.includes('not found') ||
                lowerMessage.includes('not supported')
            )
        ) {
            return "⚠️ The Gemini AI model is currently unavailable. Please try again later.";
        }

        /**
         * 401 / 403 - API key or permission problem
         */
        if (status === 401 || status === 403) {
            return "⚠️ Gemini API authorization failed. Please check the API configuration.";
        }

        /**
         * 429 - Rate limit / quota
         */
        if (
            status === 429 ||
            lowerMessage.includes('resource_exhausted') ||
            lowerMessage.includes('rate limit') ||
            lowerMessage.includes('too many requests')
        ) {

            // Detect hard quota exhaustion
            const isHardLimit =
                lowerMessage.includes('quota') &&
                !lowerMessage.includes('minute') &&
                !lowerMessage.includes('second');

            if (isHardLimit) {
                console.error(
                    '[Gemini] Quota exhausted. Activating circuit breaker.'
                );

                activateCircuitBreaker();

                return FALLBACK_MESSAGE;
            }

            // Retry temporary rate limits
            if (retryCount < 3) {

                const delayMs =
                    Math.pow(2, retryCount) * 2000 +
                    Math.random() * 1000;

                console.warn(
                    `[Gemini] Rate limited. Retrying in ${Math.round(delayMs)}ms...`
                );

                await new Promise(resolve =>
                    setTimeout(resolve, delayMs)
                );

                return safeExecute(
                    apiCall,
                    retryCount + 1
                );
            }

            return "⚠️ Gemini is temporarily busy. Please try again shortly.";
        }

        /**
         * 500 / 502 / 503 / 504 - Temporary server errors
         */
        if (
            status === 500 ||
            status === 502 ||
            status === 503 ||
            status === 504
        ) {

            if (retryCount < 3) {

                const delayMs =
                    Math.pow(2, retryCount) * 2000;

                console.warn(
                    `[Gemini] Server error ${status}. Retrying in ${delayMs}ms...`
                );

                await new Promise(resolve =>
                    setTimeout(resolve, delayMs)
                );

                return safeExecute(
                    apiCall,
                    retryCount + 1
                );
            }

            return "⚠️ Danscom is  temporarily unavailable. Please try again shortly.";
        }

        /**
         * Unknown error
         */
        return "Danscom AI is currently unavailable. Please try again shortly.";
    }
}

/**
 * Activate circuit breaker
 */
function activateCircuitBreaker() {

    isDailyQuotaExhausted = true;

    if (quotaResetTimeout) {
        clearTimeout(quotaResetTimeout);
    }

    quotaResetTimeout = setTimeout(() => {

        isDailyQuotaExhausted = false;

        quotaResetTimeout = null;

        console.log(
            '[Gemini] Circuit breaker reset. Gemini requests enabled again.'
        );

    }, COOLDOWN_MS);
}

/**
 * Text-based AI Assistant
 */
export async function geminiAssistant(
    prompt: string,
    systemInstruction?: string
): Promise<string> {

    if (!config.geminiApiKey) {

        console.error(
            '[Gemini] GEMINI_API_KEY is missing.'
        );

        return "⚠️ Gemini AI is not configured correctly.";
    }

    return safeExecute(() =>
        client.models.generateContent({

            model: MODEL_NAME,

            ...(systemInstruction
                ? {
                    config: {
                        systemInstruction
                    }
                }
                : {}),

            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ]
        })
    );
}

/**
 * Vision-based Image Description
 */
export async function generateImageDescription(
    imageUrl: string
): Promise<string> {

    if (!config.geminiApiKey) {

        console.error(
            '[Gemini] GEMINI_API_KEY is missing.'
        );

        return "⚠️ Gemini AI is not configured correctly.";
    }

    return safeExecute(async () => {

        // Download image
        const res = await axios.get(
            imageUrl,
            {
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        const base64Data =
            Buffer.from(res.data).toString('base64');

        const mimeType =
            res.headers['content-type'] || 'image/jpeg';

        return client.models.generateContent({

            model: MODEL_NAME,

            contents: [
                {
                    role: 'user',

                    parts: [

                        {
                            inlineData: {
                                data: base64Data,
                                mimeType
                            }
                        },

                        {
                            text:
                                'Provide a concise and accurate description of this image.'
                        }

                    ]
                }
            ]
        });
    });
}

/**
 * Export model name for debugging if needed
 */
export const GEMINI_MODEL = MODEL_NAME;