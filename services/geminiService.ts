
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Healthcare Intelligence Service
 * Optimized for Gemini 3.0
 */

export const analyzeSymptoms = async (symptoms: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a professional clinical assistant. Perform a high-level analysis of these symptoms:
      
      "${symptoms}"
      
      Provide:
      1. Potential concerns (non-diagnostic).
      2. Recommended urgency level.
      3. Questions for the patient to ask their doctor.
      
      DISCLAIMER: This is an AI assessment and not a medical diagnosis.`,
      config: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    return response.text || "The diagnostic engine is unable to process this request. Rephrase your symptoms.";
  } catch (e) {
    console.error("Gemini Symptom Analysis Error:", e);
    return "Clinical AI offline. Please consult the specialists in the directory directly.";
  }
};

export const summarizePatientHistory = async (history: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize the following clinical dialogue/history for a medical consultant:
      
      "${history}"
      
      Highlight key medical complaints and potential risks.`,
      config: {
        temperature: 0.3,
      },
    });
    return response.text || "Summary unavailable.";
  } catch (e) {
    console.error("Gemini History Summary Error:", e);
    return "The AI scribe is currently unable to process the history.";
  }
};

export const getHealthTips = async () => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 3 personalized health tips for wellness and preventative care.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["title", "description", "category"],
          }
        }
      }
    });
    
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.error("Gemini Health Tips Error:", e);
    return [
      { title: "Hydration", description: "Drink 3 liters of water daily.", category: "Wellness" },
      { title: "Activity", description: "Walk for 30 minutes today.", category: "Fitness" },
      { title: "Rest", description: "Ensure 8 hours of sleep.", category: "Recovery" }
    ];
  }
};
