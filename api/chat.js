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

  const systemText = `Você é o NeoMind, assistente de inteligência de produtos da Neogrid — especialista em soluções de supply chain B2B. Responda sempre em português, de forma objetiva e consultiva. Conhece: VMI (gestão colaborativa de estoque, resultados: Carrefour & Ypê +63% sell-out -45% rupturas), DRP (planejamento de distribuição, 33 métodos estatísticos, resultados: -3,5 p.p. ruptura, R$283.200 ganho), S&OP (planejamento integrado de vendas e operações), NeoSmart Order (pedidos automatizados), NeoLog (colaboração logística, dashboards), EDI Mercantil (+4.900 indústrias, R$216 bilhões/ano, +30% nível de serviço), EDI Logístico (automação logística, integração ERP/TMS).`;

  const contents = [];
  if (history && history.length > 0) {
    for (const msg of history.slice(-6)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  // Lista de modelos para tentar em ordem
  const models = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const body = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      };

      // system_instruction só em modelos que suportam
      if (model !== 'gemini-pro') {
        body.system_instruction = { parts: [{ text: systemText }] };
      } else {
        // para gemini-pro, adiciona contexto no primeiro user message
        body.contents = [
          { role: 'user', parts: [{ text: systemText + '\n\nPergunta: ' + message }] },
          ...contents.slice(0, -1)
        ];
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
        console.log(`Modelo funcionando: ${model}`);
        return res.status(200).json({ response: text, model });
      }

      const errData = await response.json();
      console.log(`Modelo ${model} falhou: ${response.status} - ${JSON.stringify(errData.error?.message)}`);
      
      // Se não for 404, algo mais sério — para aqui
      if (response.status !== 404 && response.status !== 400) {
        return res.status(500).json({ 
          error: `Erro ${response.status}`, 
          model,
          details: errData.error?.message 
        });
      }

    } catch (e) {
      console.log(`Modelo ${model} erro: ${e.message}`);
    }
  }

  return res.status(500).json({ 
    error: 'Nenhum modelo Gemini disponível para esta chave API. Verifique se a chave está correta e ativa no Google AI Studio.',
    tested: models
  });
}
