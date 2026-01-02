
import { GoogleGenAI, Type } from "@google/genai";

// Initialize GoogleGenAI lazily or with a safety check to prevent top-level boot errors
const getAI = () => {
  try {
    const key = process.env.API_KEY;
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.error("MediSphere AI Init Error:", e);
    return null;
  }
};

const ai = getAI();

export const analyzeSymptoms = async (symptoms: string) => {
  if (!ai) return "AI medical analysis is currently offline. Please consult a clinician directly.";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Analyze the following symptoms and provide a potential health assessment. 
    Disclaimer: Always mention this is not a substitute for professional medical advice.
    Symptoms: ${symptoms}`,
    config: {
      temperature: 0.7,
      maxOutputTokens: 500,
      thinkingConfig: { thinkingBudget: 250 },
    },
  });
  return response.text || "Diagnostic analysis returned no results.";
};

export const summarizePatientHistory = async (history: string) => {
  if (!ai) return "AI Synthesis offline.";
  
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
};

export const getHealthTips = async () => {
  if (!ai) return [];
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
            propertyOrdering: ["title", "description", "category"],
          }
        }
      }
    });
    const jsonStr = response.text?.trim();
    return JSON.parse(jsonStr || "[]");
  } catch (e) {
    console.error("MediSphere Health Tips Error:", e);
    return [];
  }
};
