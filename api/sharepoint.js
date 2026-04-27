// ============================================================
// NeoMind — Integração SharePoint (aguardando credenciais TI)
// ============================================================
// Para ativar: adicionar na Vercel as variáveis de ambiente:
//   AZURE_TENANT_ID     — obtido com o time de TI
//   AZURE_CLIENT_ID     — obtido com o time de TI  
//   AZURE_CLIENT_SECRET — obtido com o time de TI
//   SHAREPOINT_SITE_ID  — ID do site SharePoint de PMkt
// ============================================================

async function getAccessToken() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  
  const response = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'
      })
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw new Error(`Token error: ${data.error_description}`);
  return data.access_token;
}

async function searchSharePoint(token, siteId, query) {
  // Busca arquivos por nome ou conteúdo no SharePoint
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/search(q='${encodeURIComponent(query)}')`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw new Error(`Search error: ${JSON.stringify(data)}`);
  return data.value || [];
}

async function getFileDetails(token, siteId, fileId) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${fileId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw new Error(`File error: ${JSON.stringify(data)}`);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { query, type } = req.body;
  // type: 'search' | 'latest' | 'compare'
  
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, SHAREPOINT_SITE_ID } = process.env;
  
  // Verifica se credenciais estão configuradas
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !SHAREPOINT_SITE_ID) {
    return res.status(503).json({ 
      error: 'Integração com SharePoint ainda não ativada.',
      message: 'Aguardando liberação das credenciais Azure pelo time de TI.',
      required: ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'SHAREPOINT_SITE_ID']
    });
  }
  
  try {
    const token = await getAccessToken();
    const files = await searchSharePoint(token, SHAREPOINT_SITE_ID, query);
    
    if (files.length === 0) {
      return res.status(200).json({ 
        results: [],
        message: `Nenhum arquivo encontrado para "${query}"` 
      });
    }
    
    // Ordena por data de modificação (mais recente primeiro)
    const sorted = files
      .map(f => ({
        name: f.name,
        lastModified: f.lastModifiedDateTime,
        lastModifiedBy: f.lastModifiedBy?.user?.displayName || 'Desconhecido',
        webUrl: f.webUrl,
        size: f.size,
        id: f.id
      }))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    
    // Para busca de versão mais recente
    if (type === 'latest') {
      return res.status(200).json({
        latest: sorted[0],
        others: sorted.slice(1),
        total: sorted.length
      });
    }
    
    return res.status(200).json({ results: sorted });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
