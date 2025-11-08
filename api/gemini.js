// api/gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGINS || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { prompt, model = "gemini-1.5-flash" } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Falta "prompt"' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const m = genAI.getGenerativeModel({ model });

    const result = await m.generateContent(prompt);
    const text = result.response.text();

    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || "Gemini error" });
  }
};
