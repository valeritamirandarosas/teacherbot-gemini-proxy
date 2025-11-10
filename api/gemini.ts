// File: api/gemini.ts

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- CONFIGURACIÓN DE CORS ---
function allowCors(fn: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    return await fn(req, res);
  };
}

// --- CONFIGURACIÓN DE LA API DE GEMINI ---
const API_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(API_KEY);
// *** ESTA ES LA LÍNEA CORREGIDA ***
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


// --- LÓGICA DE LOS ENDPOINTS ---

async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { endpoint, payload } = req.body;

    if (!endpoint || !payload) {
      return res.status(400).json({ error: 'Falta "endpoint" o "payload" en el cuerpo de la petición.' });
    }

    let prompt;
    
    // NOTA: Tu lógica original para construir los prompts era correcta. La restauramos.
    if (endpoint === 'chat') {
        const { character, mode, subject, messages } = payload;
        const history = messages.map((m: { role: string, content: string }) => ({
            role: m.role === 'assistant' ? 'model' : 'user', // Gemini usa 'model' para el rol del asistente
            parts: [{ text: m.content }]
        }));

        const userMessage = history.pop().parts[0].text;
        
        prompt = `Actúa como ${character.name} (${character.prompt}). El modo es "${mode.label}". El tema es "${subject}". El estudiante dice: "${userMessage}". Responde de forma concisa y directa.`;
    
    } else if (endpoint === 'bundle') {
        const { subject, grade, character } = payload;
        prompt = `Crea un paquete de estudio JSON para ${subject}, grado ${grade}, con el tutor ${character.name}.`;
    
    } else {
      return res.status(400).json({ error: 'Endpoint no válido. Usa "chat" o "bundle".' });
    }
    
    const result = await model.generateContent(prompt);
    
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

    return res.status(200).json({ reply: responseText });

  } catch (error: any) {
    console.error('Error en el proxy de Gemini:', error);
    res.status(500).json({
      error: 'Error interno del servidor al contactar a Gemini.',
      details: error.message,
    });
  }
}

export default allowCors(handler);
