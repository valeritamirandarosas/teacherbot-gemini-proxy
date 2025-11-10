// File: api/gemini.ts

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- CONFIGURACIÓN DE CORS ---
// Middleware simple para añadir las cabeceras CORS a la respuesta
function allowCors(fn: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Permite peticiones desde CUALQUIER origen. Para mayor seguridad, puedes cambiar '*'
    // por el dominio de tu app de Firebase: 'https://innovatec-chatbot-XXXX.web.app'
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Maneja las peticiones pre-flight de CORS (método OPTIONS)
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    return await fn(req, res);
  };
}
// --- FIN DE LA CONFIGURACIÓN DE CORS ---

// Configuración de la API de Gemini
const API_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

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
    let schema;

    if (endpoint === 'chat') {
        const { character, mode, subject, messages } = payload;
        const history = messages.map((m: { role: string, content: string }) => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));

        // El último mensaje es el que se va a procesar
        const userMessage = history.pop().parts[0].text;

        prompt = `Actúa como ${character.name} (${character.prompt}). El modo es "${mode.label}". El tema es "${subject}". El estudiante dice: "${userMessage}". Responde de forma concisa y directa.`;
        schema = { type: "string" }; // Esperamos una respuesta de texto simple
    } else if (endpoint === 'bundle') {
        const { subject, grade, character } = payload;
        // El prompt ya está bien definido en tu código original para el bundle
        prompt = `Crea un paquete de estudio JSON para ${subject}, grado ${grade}, con el tutor ${character.name}.`;
        schema = payload.schema; // Reutilizamos el esquema Zod que se envía en el payload
    } else {
      return res.status(400).json({ error: 'Endpoint no válido. Usa "chat" o "bundle".' });
    }
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });
    
    const responseText = result.response.text();
    
    // Para el bundle, intentamos parsear el JSON
    if (endpoint === 'bundle') {
        try {
            const jsonResponse = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));
            return res.status(200).json(jsonResponse);
        } catch (e) {
            console.error("Error al parsear la respuesta JSON de Gemini:", e);
            return res.status(500).json({ error: 'La respuesta de la IA no era un JSON válido.' });
        }
    }

    // Para el chat, devolvemos el texto plano en un objeto
    return res.status(200).json({ reply: responseText });

  } catch (error: any) {
    console.error('Error en el proxy de Gemini:', error);
    res.status(500).json({
      error: 'Error interno del servidor al contactar a Gemini.',
      details: error.message,
    });
  }
}

// Exportamos el handler envuelto en el middleware de CORS
export default allowCors(handler);
