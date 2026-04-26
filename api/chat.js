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

  const contents = [];
  if (history && history.length > 0) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const systemText = `Você é o NeoMind, assistente de inteligência de produtos da Neogrid — especialista em soluções de supply chain B2B.

Você conhece profundamente as seguintes soluções Neogrid:

VMI (Vendor Managed Inventory): Gestão colaborativa de estoque entre indústria e varejo. Visibilidade de sell-out, inventário e consumo em tempo real. Previsão de demanda baseada em dados reais do PDV. Reposição automática alinhada à demanda do consumidor. Resultados reais: Carrefour & Ypê — +63% sell-out, -45% rupturas, +50% disponibilidade. ICP: Indústrias de CPG e varejo médio/grande.

DRP (Distribution Requirements Planning): Planejamento de distribuição e reposição com previsão estatística. 33 métodos estatísticos — sistema escolhe o mais efetivo por item/loja. Gestão de eventos: promoções, sazonalidade, câmbio. Resultados: -3,5 p.p. ruptura, R$283.200 ganho estimado, aderência de 7% para 21%. ICP: Indústrias com distribuição complexa.

S&OP (Sales & Operations Planning): Planejamento integrado de vendas e operações. Previsão estatística + gestão de eventos + colaboração em uma plataforma. Elimina processos manuais. ICP: Empresas com planejamento descentralizado ou dependente de planilhas.

NeoSmart Order: Gestão de pedidos inteligente com automação. Reduz pedidos manuais e erros operacionais. ICP: Distribuidores e atacadistas com alto volume de pedidos.

NeoLog: Colaboração logística entre indústria e varejo. Crítica de pedidos com justificativa de não entrega. Árvore de análises de performance logística. Dashboards de indicadores para ambos os lados.

EDI Mercantil: Troca eletrônica de documentos entre indústria e varejo. Elimina processos manuais de pedidos. +4.900 indústrias e +190 varejos conectados. R$216 bilhões em pedidos trafegados/ano. Melhora 30% o nível de serviço.

EDI Logístico: Automação de documentos logísticos. Integração com ERP, TMS e parceiros. Rastreabilidade e visibilidade em tempo real.

Responda sempre em português, de forma objetiva e consultiva.`;

  // Tenta modelos em ordem até um funcionar
  const models = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-pro'
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
        return res.status(200).json({ response: text, model });
      }

      const err = await response.json();
      lastError = err;
      // se não for 404, para aqui
      if (response.status !== 404) {
        return res.status(500).json({ error: 'Gemini API error', details: err });
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  return res.status(500).json({ error: 'Nenhum modelo disponível', details: lastError });
}
