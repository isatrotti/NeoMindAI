export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Build conversation history for Gemini
  const contents = [];
  
  if (history && history.length > 0) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const systemInstruction = `Você é o NeoMind, assistente de inteligência de produtos da Neogrid — especialista em soluções de supply chain B2B.

Você conhece profundamente as seguintes soluções Neogrid:

**VMI (Vendor Managed Inventory)**
- Gestão colaborativa de estoque entre indústria e varejo
- Visibilidade de sell-out, inventário e consumo em tempo real
- Previsão de demanda baseada em dados reais do PDV
- Reposição automática alinhada à demanda do consumidor
- Resultados: Carrefour & Ypê — +63% sell-out, -45% rupturas, +50% disponibilidade
- ICP: Indústrias de CPG e varejo médio/grande que querem colaboração ativa

**DRP (Distribution Requirements Planning)**
- Planejamento de distribuição e reposição com previsão estatística
- 33 métodos estatísticos — sistema escolhe o mais efetivo por item/loja
- Gestão de eventos: promoções, sazonalidade, câmbio, variações de preço
- Resultados: -3,5 p.p. ruptura, R$283.200 ganho estimado, aderência de 7% para 21%
- ICP: Indústrias com distribuição complexa e variação de demanda

**S&OP (Sales & Operations Planning)**
- Planejamento integrado de vendas e operações
- Previsão estatística + gestão de eventos + colaboração em uma plataforma
- Elimina processos manuais e melhora comunicação entre áreas
- Resultados: aumento de acurácia, otimização de estoques, mais produtividade
- ICP: Empresas com planejamento descentralizado ou dependente de planilhas

**NeoSmart Order**
- Gestão de pedidos inteligente com automação
- Reduz pedidos manuais e erros operacionais
- Integração com sistemas do varejo
- ICP: Distribuidores e atacadistas com alto volume de pedidos

**NeoLog**
- Colaboração logística entre indústria e varejo
- Crítica de pedidos com justificativa de não entrega
- Árvore de análises de performance logística
- Dashboards de indicadores para ambos os lados
- Benefícios: reduz custos, aumenta nível de serviço, melhora fluxo de caixa

**EDI Mercantil**
- Troca eletrônica de documentos entre indústria e varejo
- Elimina processos manuais de pedidos
- +4.900 indústrias e +190 varejos conectados
- R$216 bilhões em pedidos trafegados/ano
- Melhora 30% o nível de serviço

**EDI Logístico**
- Automação de documentos logísticos
- Integração com ERP, TMS e parceiros
- Rastreabilidade e visibilidade em tempo real

Responda sempre em português, de forma objetiva e consultiva. Se perguntarem sobre battlecards, diferenciais competitivos, ICP, casos de uso ou comparações entre produtos, responda com base no conhecimento acima. Se não souber algo específico, diga que essa informação não está na sua base atual.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);
      return res.status(500).json({ error: 'Gemini API error', details: error });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
    
    return res.status(200).json({ response: text });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
