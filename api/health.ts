export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  return res.status(200).json({
    status: 'ok',
    name: 'TeacherBot Gemini Proxy',
    version: '1.0.0',
    time: new Date().toISOString(),
  });
}
