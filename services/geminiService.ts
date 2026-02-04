
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Healthcare Intelligence Service
 * Optimized for Centralized Hospital Management
 */

const getAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("Missing API Credentials");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeSymptoms = async (symptoms: string) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Patient symptoms: "${symptoms}"`,
      config: {
        systemInstruction: `You are a clinical diagnostic logic engine for Byinks Health. Analyze the symptoms and provide:
        1. Clinical Observations: Patterns identified.
        2. Urgency: Routine, Urgent, or Emergency.
        3. Specialist Questions: Preparation for the doctor.
        
        DISCLAIMER: This is an AI-powered assessment. Not a medical diagnosis.`,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 1000 }
      },
    });

    return response.text || "Clinical analysis yielded inconclusive results. Please consult a human specialist.";
  } catch (e: any) {
    console.error("Clinical AI failure:", e);
    return "The central clinical AI is temporarily recalibrating for global sync. Please consult our human specialists in the directory.";
  }
};

export const analyzeMedicalReport = async (reportContext: string) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Report Details: "${reportContext}"`,
      config: {
        systemInstruction: "You are a clinical report reviewer. Extract key abnormal findings, suggest possible clinical implications for the doctor, and highlight urgent metrics.",
        temperature: 0.3,
      },
    });
    return response.text || "AI analysis of the report is unavailable.";
  } catch (e) {
    return "Clinical intelligence engine unable to parse this report fragment.";
  }
};

export const summarizePatientHistory = async (messages: string) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Consultation log: "${messages}"`,
      config: {
        systemInstruction: "You are a clinical scribe. Summarize key medical concerns and action items from this dialogue.",
        temperature: 0.2,
      },
    });
    return response.text || "Awaiting further dialogue history.";
  } catch (e) {
    console.error("Scribe failure:", e);
    return "AI Scribe is currently unable to sync with this thread.";
  }
};

export const getHealthTips = async () => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 3 evidence-based wellness tips.",
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
    return response.text ? JSON.parse(response.text) : [];
  } catch (e) {
    return [
      { title: "Clinical Hydration", description: "Maintain 3L daily water intake.", category: "Wellness" },
      { title: "Sleep Hygiene", description: "Prioritize 8 hours of restorative sleep.", category: "Recovery" },
      { title: "Metabolic Activity", description: "Engage in 20min brisk movement daily.", category: "Fitness" }
    ];
  }
};
