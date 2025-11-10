// File: api/gemini.ts

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- ENVOLTORIO DE CORS ---
// Esta función intercepta las peticiones para añadir las cabeceras CORS.
function allowCors(fn: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Permite peticiones desde cualquier origen.
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Si la petición es un 'preflight' de CORS (método OPTIONS), respondemos inmediatamente con OK.
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Si no, continuamos con la lógica normal de la API.
    return await fn(req, res);
  };
}

// --- CONFIGURACIÓN DE LA API DE GEMINI ---
const API_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- LÓGICA PRINCIPAL DE LA API ---
async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { prompt, history, endpoint } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Falta el "prompt" en el cuerpo de la petición.' });
    }

    const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: history || [],
    });

    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();
    
    if (endpoint === 'bundle') {
        try {
            const jsonResponse = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));
            return res.status(200).json(jsonResponse);
        } catch (e) {
            console.error("Error al parsear la respuesta JSON de Gemini:", e);
            return res.status(500).json({ error: 'La respuesta de la IA no era un JSON válido.' });
        }
    }

    // Para el chat, devolvemos el texto plano en un objeto.
    return res.status(200).json({ reply: responseText });

  } catch (error: any) {
    console.error('Error en el proxy de Gemini:', error);
    res.status(500).json({
      error: 'Error interno del servidor al contactar a Gemini.',
      details: error.message,
    });
  }
}

// Exportamos nuestra función principal envuelta en el manejador de CORS.
export default allowCors(handler);
