
import { GoogleGenAI } from "@google/genai";
import { MANAGER_SUPPORT_MANUAL } from "../constants.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Standard chat session for text-based system guidance.
 */
export const startAIChatSession = (context?: string) => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are the FuPPAS Enterprise System Instructor. 
      Your primary role is to help users navigate and master the ERP. 
      
      CORE SYSTEM KNOWLEDGE:
      ${MANAGER_SUPPORT_MANUAL}
      
      BEHAVIOR:
      - Be precise, technical, yet helpful.
      - If the user asks about something not in the manual, use general ERP best practices.
      - Remind managers that "Voiding" is the standard for errors, as deletions are blocked for audit integrity.
      
      CONTEXT:
      ${context || 'General support session.'}`,
    },
  });
};

/**
 * Multimodal analysis for screenshots and complex visual queries.
 */
export const analyzeMultimodalContent = async (text: string, imageData?: { data: string, mimeType: string }, context?: string) => {
  const parts: any[] = [{ text: `
    SYSTEM CONTEXT: ${context || 'General Support'}
    USER MANUAL: ${MANAGER_SUPPORT_MANUAL}
    
    USER INSTRUCTION: ${text}
    
    VISUAL ANALYSIS TASK:
    The user has provided a screenshot of the FuPPAS ERP. 
    1. Identify which module is visible (Dashboard, Inventory, Jobs, etc.).
    2. Read the data points, status colors, and numerical values shown.
    3. Answer the user's specific instruction based on the visual evidence.
    4. If the image is blurry or irrelevant, ask for a clearer system screenshot.
  ` }];

  if (imageData) {
    parts.push({
      inlineData: imageData
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts }],
  });

  return response.text;
};
