// Simple proxy para Gemini (POST { prompt, model?, generationConfig? })
export default async function handler(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const allowOrigin = origin && allowed.includes(origin) ? origin : (allowed[0] || '*');
  const cors = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v as string);
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v as string);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model = 'gemini-1.5-flash', generationConfig } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      for (const [k, v] of Object.entries(cors)) res.setHeader(k, v as string);
      return res.status(400).json({ error: 'Missing "prompt"' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      for (const [k, v] of Object.entries(cors)) res.setHeader(k, v as string);
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024, ...(generationConfig || {}) }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();

    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v as string);
    if (!r.ok) return res.status(r.status).json({ error: 'Gemini API error', details: data });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ text, raw: data });
  } catch (e: any) {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v as string);
    return res.status(500).json({ error: 'Proxy failure', details: String(e?.message || e) });
  }
}
