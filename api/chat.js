export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const systemText = `Você é o NeoMind, assistente de inteligência de produtos da Neogrid — especialista em soluções de supply chain B2B. Responda sempre em português, de forma objetiva e consultiva.

Conhece profundamente:
- VMI (Vendor Managed Inventory): gestão colaborativa de estoque entre indústria e varejo, visibilidade de sell-out em tempo real. Resultados: Carrefour & Ypê +63% sell-out, -45% rupturas, +50% disponibilidade.
- DRP: planejamento de distribuição com 33 métodos estatísticos. Resultados: -3,5 p.p. ruptura, R$283.200 ganho estimado, aderência de 7% para 21%.
- S&OP: planejamento integrado de vendas e operações, elimina processos manuais.
- NeoSmart Order: gestão de pedidos automatizada para distribuidores e atacadistas.
- NeoLog: colaboração logística, crítica de pedidos, árvore de análises, dashboards de indicadores.
- EDI Mercantil: troca eletrônica de documentos, +4.900 indústrias e +190 varejos conectados, R$216 bilhões trafegados/ano, melhora 30% nível de serviço.
- EDI Logístico: automação de documentos logísticos, integração com ERP e TMS.`;

  const messages = [{ role: 'system', content: systemText }];
  
  if (history && history.length > 0) {
    for (const msg of history.slice(-8)) {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://neo-mind-ai-kappa.vercel.app',
        'X-Title': 'NeoMind AI'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Erro na API', details: data.error?.message || JSON.stringify(data) });
    }

    const text = data.choices?.[0]?.message?.content || 'Sem resposta';
    return res.status(200).json({ response: text });

  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
