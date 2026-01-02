
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Healthcare Intelligence Service
 * Optimized for Gemini 3.0 series
 */

export const analyzeSymptoms = async (symptoms: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a clinical diagnostic logic engine. Analyze the following patient symptoms:
      
      "${symptoms}"
      
      Structure your response:
      - Clinical Observations: High-level reasoning.
      - Urgency Metric: (Routine, Urgent, or Emergency).
      - Physician Guidance: Questions for the patient to ask their consultant.
      
      DISCLAIMER: This is an AI assessment, not a medical diagnosis. Consult a human specialist.`,
      config: {
        temperature: 0.4,
        topP: 0.9,
      },
    });

    return response.text || "Diagnostic analysis yielded no clear clinical patterns.";
  } catch (e) {
    console.error("AI Analysis Error:", e);
    return "The clinical AI is currently offline for calibration. Please consult a human doctor.";
  }
};

// Fixed: Renamed from summarizeConversation to summarizePatientHistory to resolve import error in ConsultantDashboard.tsx
export const summarizePatientHistory = async (messages: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a clinical scribe. Summarize this secure healthcare dialogue between a patient and consultant:
      
      "${messages}"
      
      Identify:
      1. Primary medical concerns.
      2. Any mentioned medications or past history.
      3. Action items for the doctor.`,
      config: {
        temperature: 0.2,
      },
    });
    return response.text || "Awaiting further clinical data to generate summary.";
  } catch (e) {
    console.error("AI Scribe Error:", e);
    return "Unable to synchronize AI context for this conversation thread.";
  }
};

export const getHealthTips = async () => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 3 personalized medical wellness tips for a patient portal feed.",
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
    console.error("AI Health Tips Error:", e);
    return [
      { title: "Hydration Focus", description: "Maintain consistent water intake for metabolic support.", category: "Wellness" },
      { title: "Recovery Sleep", description: "Prioritize 8 hours of rest for cognitive restoration.", category: "Recovery" },
      { title: "Active Mobility", description: "Engage in 20 minutes of movement to improve circulation.", category: "Fitness" }
    ];
  }
};
