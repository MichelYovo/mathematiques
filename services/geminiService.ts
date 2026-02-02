
import { GoogleGenAI, Modality } from "@google/genai";
import { GcdResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an initial explanation for the GCD result.
 */
export const getInitialExplanation = async (result: GcdResult): Promise<string> => {
  const prompt = `
    En tant qu'expert en mathématiques (Professeur), explique le calcul du PGCD de ${result.n} et ${result.m} que nous venons de trouver (${result.gcd}).
    L'algorithme d'Euclide a été utilisé avec les étapes suivantes : ${result.steps.map(s => `${s.n} % ${s.m} = ${s.remainder}`).join(', ')}.
    Donne une explication pédagogique, claire et concise en français.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Erreur lors de la génération.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Désolé, je ne peux pas expliquer pour le moment.";
  }
};

/**
 * Converts a text explanation into audio using Gemini TTS.
 */
export const speakExplanation = async (text: string): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Lis ceci de manière pédagogique : ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Professional/Academic voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

/**
 * Creates a chat session for follow-up questions.
 */
export const createMathChat = (result: GcdResult) => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `Tu es un tuteur en mathématiques spécialisé dans l'arithmétique. 
      L'utilisateur vient de calculer le PGCD de ${result.n} et ${result.m} et a obtenu ${result.gcd}.
      Réponds à ses questions sur ce calcul ou sur le PGCD en général. 
      Sois précis, utilise un langage mathématique correct mais accessible. 
      Utilise le format Markdown pour tes réponses.`,
    },
  });
};
