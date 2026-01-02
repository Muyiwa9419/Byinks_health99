
import { GoogleGenAI, Type } from "@google/genai";

// Initialize GoogleGenAI directly using the environment variable as per guidelines.
// Coding Guideline: Always use process.env.API_KEY directly for initialization.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSymptoms = async (symptoms: string) => {
  // Use gemini-3-pro-preview for complex text tasks such as symptom analysis.
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
  // Coding Guideline: Access the generated text directly through the .text property.
  return response.text || "AI services are currently unavailable. Please consult a doctor immediately.";
};

export const summarizePatientHistory = async (history: string) => {
  // Use gemini-3-flash-preview for basic text tasks like medical history summarization.
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this patient's medical history for a busy consultant. 
    Focus on key diagnoses, medications, and recent trends.
    History: ${history}`,
    config: {
      temperature: 0.2,
    },
  });
  // Coding Guideline: Access the generated text directly through the .text property.
  return response.text || "Unable to generate summary at this time.";
};

export const getHealthTips = async () => {
  try {
    // Generate content using a responseSchema to ensure structured JSON output.
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
    // Coding Guideline: response.text is a property, use .trim() for clean parsing.
    const jsonStr = response.text?.trim();
    return JSON.parse(jsonStr || "[]");
  } catch (e) {
    console.error("MediSphere Gemini Error:", e);
    return [];
  }
};
