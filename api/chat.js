export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Fingerprint');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      service: 'givbox-proxy',
      timestamp: new Date().toISOString()
    });
  }

  // POST запрос
  if (req.method === 'POST') {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Поле messages обязательно' });
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

      if (!OPENAI_API_KEY) {
        return res.status(500).json({ message: 'API ключ не настроен' });
      }

      const apiMessages = [
        { 
          role: 'system', 
          content: 'Ты — GIV BOX AI, дружелюбный ассистент. Отвечай на русском.' 
        },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content || m.text || ''
        }))
      ];

      const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: apiMessages,
          max_tokens: 2048,
          temperature: 0.7
        })
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('OpenAI error:', apiResponse.status, errorText);
        
        if (apiResponse.status === 429) {
          return res.status(503).json({
            message: 'ИИ перегружен. Попробуйте через минуту.',
            retryAfter: 60
          });
        }
        
        return res.status(500).json({ message: 'Ошибка API' });
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || 'Нет ответа';

      return res.status(200).json({ content });

    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Внутренняя ошибка' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
