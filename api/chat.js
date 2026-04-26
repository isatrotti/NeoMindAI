export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const systemText = `Você é o NeoMind, assistente de inteligência de produtos da Neogrid — especialista em soluções de supply chain B2B.

Conhece profundamente: VMI (Vendor Managed Inventory) — gestão colaborativa de estoque, visibilidade de sell-out, resultados: Carrefour & Ypê +63% sell-out -45% rupturas. DRP — planejamento de distribuição com 33 métodos estatísticos, resultados: -3,5 p.p. ruptura, R$283.200 ganho. S&OP — planejamento integrado de vendas e operações. NeoSmart Order — gestão de pedidos automatizada. NeoLog — colaboração logística, crítica de pedidos, dashboards. EDI Mercantil — troca eletrônica de documentos, +4.900 indústrias conectadas, R$216 bilhões trafegados/ano, melhora 30% nível de serviço. EDI Logístico — automação de documentos logísticos, integração ERP/TMS.

Responda sempre em português, de forma objetiva e consultiva. Para perguntas sobre battlecards, ICP, diferenciais ou comparações, use o conhecimento acima.`;

  const contents = [];
  if (history && history.length > 0) {
    for (const msg of history.slice(-8)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  // gemini-2.0-flash é o modelo padrão atual para keys novas
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(500).json({ 
        error: `Gemini error ${response.status}`, 
        details: data.error?.message || JSON.stringify(data)
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
    return res.status(200).json({ response: text });

  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
