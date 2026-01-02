
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Healthcare Intelligence Service
 * Powered by Gemini 3.0
 */

const getAIInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeSymptoms = async (symptoms: string) => {
  try {
    const ai = getAIInstance();
    // Using gemini-3-pro-preview for complex medical reasoning tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a clinical diagnostic assistant. Analyze the following symptoms and provide a potential health assessment. 
      IMPORTANT: Always include a disclaimer that this is not a substitute for professional medical advice.
      
      Symptoms to analyze: ${symptoms}`,
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    return response.text || "The diagnostic engine could not interpret the provided symptoms. Please try rephrasing.";
  } catch (e: any) {
    console.error("Clinical AI Analysis Failure:", e);
    if (e.message?.includes("API_KEY")) {
      return "Critical Error: Clinical AI credentials are not configured. Please contact the system administrator.";
    }
    return "The clinical AI engine is experiencing high latency or is currently offline. Please consult a human specialist immediately.";
  }
};

export const summarizePatientHistory = async (history: string) => {
  try {
    const ai = getAIInstance();
    // Using gemini-3-flash-preview for fast summarization
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a medical scribe. Summarize the following patient clinical history for a consultant. 
      Highlight significant diagnoses, medication lists, and alarming trends.
      
      Clinical Data: ${history}`,
      config: {
        temperature: 0.2,
      },
    });
    return response.text || "History summarization yielded no significant clinical insights.";
  } catch (e) {
    console.error("Clinical AI Summary Failure:", e);
    return "The AI Scribe is currently unable to synchronize patient history. Please review the raw records.";
  }
};

export const getHealthTips = async () => {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 3 personalized daily health tips for a general patient to improve holistic well-being.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Short title of the tip" },
              description: { type: Type.STRING, description: "Actionable healthcare advice" },
              category: { type: Type.STRING, description: "Health domain (e.g., Wellness, Nutrition)" }
            },
            required: ["title", "description", "category"],
          }
        }
      }
    });
    
    const jsonStr = response.text?.trim();
    if (!jsonStr) return getDefaultTips();
    
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Health Intelligence Feed Failure:", e);
    return getDefaultTips();
  }
};

const getDefaultTips = () => [
  { title: "Hydration Protocol", description: "Consume 3 liters of filtered water today to maintain renal efficiency.", category: "Wellness" },
  { title: "Circadian Alignment", description: "Expose your eyes to sunlight for 15 minutes this morning to regulate cortisol.", category: "Recovery" },
  { title: "Nutritional Density", description: "Incorporate dark leafy greens into your next meal for magnesium support.", category: "Nutrition" }
];
