
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Initialize GoogleGenAI with process.env.API_KEY directly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSymptoms = async (symptoms: string) => {
  // Fix: Upgraded to gemini-3-pro-preview for advanced medical reasoning tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Analyze the following symptoms and provide a potential health assessment. 
    Disclaimer: Always mention this is not a substitute for professional medical advice.
    Symptoms: ${symptoms}`,
    config: {
      temperature: 0.7,
      // Fix: Added thinkingBudget to reserve tokens for output when maxOutputTokens is set
      maxOutputTokens: 500,
      thinkingConfig: { thinkingBudget: 250 },
    },
  });
  return response.text;
};

export const summarizePatientHistory = async (history: string) => {
  // Fix: Using gemini-3-flash-preview for standard summarization task
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this patient's medical history for a busy consultant. 
    Focus on key diagnoses, medications, and recent trends.
    History: ${history}`,
    config: {
      temperature: 0.2,
    },
  });
  return response.text;
};

export const getHealthTips = async () => {
  // Fix: Using gemini-3-flash-preview for general text tasks
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
  return JSON.parse(response.text || "[]");
};
