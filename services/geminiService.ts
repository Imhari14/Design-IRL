import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { TasteAnalysis, TasteProfile } from '../types';

const analysisPrompt = `Analyze this interior design image. Extract: dominant color palette (3 hex codes), key materials/textures (e.g., 'oak wood', 'linen', 'matte metal'), layout style (e.g., 'open', 'cozy', 'symmetrical'), emotional mood (e.g., 'calm', 'energetic', 'luxurious'). Return as a JSON object.`;

export const urlToBase64 = async (url: string): Promise<{ base64: string, mimeType: string }> => {
    // Using a reliable image proxy to bypass CORS issues.
    // weserv.nl requires the protocol to be stripped from the URL.
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image via proxy: ${response.statusText}`);
    }
    const blob = await response.blob();
    const mimeType = blob.type;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.error) {
                return reject(reader.error);
            }
            const base64 = (reader.result as string).split(',')[1];
            resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const analyzeImage = async (apiKey: string, base64: string, mimeType: string): Promise<TasteAnalysis> => {
  if (!apiKey) throw new Error("Gemini API key is required.");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: analysisPrompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          palette: { type: Type.ARRAY, items: { type: Type.STRING } },
          materials: { type: Type.ARRAY, items: { type: Type.STRING } },
          layout: { type: Type.STRING },
          mood: { type: Type.STRING },
        },
        required: ["palette", "materials", "layout", "mood"],
      },
    },
  });
  
  const jsonString = response.text.trim();
  return JSON.parse(jsonString) as TasteAnalysis;
};

export const generateRoom = async (apiKey: string, profile: TasteProfile, roomFunction: string): Promise<{ base64: string, mimeType: string }> => {
  if (!apiKey) throw new Error("Gemini API key is required.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Generate a photorealistic image of a ${roomFunction} that visually embodies this aesthetic profile: Color Palette: ${profile.colors.join(', ')}, Materials/Textures: ${profile.textures.join(', ')}, Mood: ${profile.moods.join(', ')}. Maintain consistent lighting, perspective, and spatial logic. Ensure the space is functional for the described use case.`;
  
  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash-image-preview',
    contents: {
      parts: [
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for await (const chunk of responseStream) {
    if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.inlineData) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
      }
    }
  }

  throw new Error('Image generation failed to produce an image.');
};

export const editImage = async (apiKey: string, image: { base64: string, mimeType: string }, userInstruction: string): Promise<{ base64: string, mimeType: string }> => {
  if (!apiKey) throw new Error("Gemini API key is required.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Modify this image to: ${userInstruction}. Preserve style, lighting, materials, and perspective.`;
  
  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash-image-preview',
    contents: {
      parts: [
        { inlineData: { data: image.base64, mimeType: image.mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for await (const chunk of responseStream) {
    if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.inlineData) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
      }
    }
  }

  throw new Error("Failed to edit image. No image was returned from the stream.");
};

export const virtualTryOn = async (apiKey: string, userImage: { base64: string, mimeType: string }, inspirationImages: { base64: string, mimeType: string }[], prompt: string): Promise<{ base64: string, mimeType: string }> => {
  if (!apiKey) throw new Error("Gemini API key is required.");
  const ai = new GoogleGenAI({ apiKey });

  const contentParts = [
    { inlineData: { data: userImage.base64, mimeType: userImage.mimeType } },
    ...inspirationImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
    { text: prompt },
  ];

  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash-image-preview',
    contents: { parts: contentParts },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for await (const chunk of responseStream) {
    if (chunk.candidates?.[0]?.content?.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.inlineData) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
      }
    }
  }

  throw new Error("Virtual try-on failed. No image was returned from the stream.");
};