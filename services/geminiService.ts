
import { GoogleGenAI, Type } from "@google/genai";

// Standard initialization as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSymptoms = async (symptoms: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze the following symptoms and provide a potential health assessment. 
      Disclaimer: Always mention this is not a substitute for professional medical advice.
      Symptoms: ${symptoms}`,
      config: {
        temperature: 0.7,
      },
    });
    return response.text || "Diagnostic analysis returned no results.";
  } catch (e) {
    console.error("AI Analysis Error:", e);
    return "The clinical AI engine is currently under maintenance. Please contact a human specialist directly.";
  }
};

export const summarizePatientHistory = async (history: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize this patient's medical history for a busy consultant. 
      Focus on key diagnoses, medications, and recent trends.
      History: ${history}`,
      config: {
        temperature: 0.2,
      },
    });
    return response.text || "Summary generation failed.";
  } catch (e) {
    console.error("AI Summary Error:", e);
    return "Unable to synchronize AI context at this time.";
  }
};

export const getHealthTips = async () => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 3 personalized daily health tips for a patient to improve their well-being.",
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
    const jsonStr = response.text?.trim();
    return JSON.parse(jsonStr || "[]");
  } catch (e) {
    console.error("Health Tips AI Error:", e);
    return [
      { title: "Stay Hydrated", description: "Drink at least 8 glasses of water daily.", category: "Wellness" },
      { title: "Daily Movement", description: "Aim for a 30-minute walk today.", category: "Fitness" },
      { title: "Sleep Hygiene", description: "Ensure 7-9 hours of restful sleep.", category: "Recovery" }
    ];
  }
};
