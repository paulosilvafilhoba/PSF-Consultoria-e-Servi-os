// ════════════════════════════════════════════════════════════════════
// IA NO BOLSO — Backend genérico (Vercel Function)
// Protege a chave da Anthropic para TODOS os artefatos do livro
// ════════════════════════════════════════════════════════════════════
// Rota: POST /api/gerar
// Body esperado: { "prompt": "...", "system": "..." (opcional) }
//
// Esta única função atende aos 10 artefatos do livro (culinária,
// visagismo, finanças, CV, viagem, histórias, resumidor, diagnóstico
// de PC, culinária por perfil). Cada HTML envia seu próprio prompt
// já formatado — esta função apenas repassa para a Anthropic com a
// chave protegida e devolve a resposta.
// ════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { prompt, system, maxTokens } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ erro: 'O campo "prompt" é obrigatório.' });
    }

    // Limite de segurança — evita prompts absurdamente longos consumindo cota
    if (prompt.length > 8000) {
      return res.status(400).json({ erro: 'Texto muito longo. Reduza o conteúdo e tente novamente.' });
    }

    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: Math.min(maxTokens || 1200, 2000),
        system: system || 'Você é um assistente especializado e prático. Responda sempre em português do Brasil, com linguagem clara e direta.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resposta.ok) {
      const erroTexto = await resposta.text();
      console.error('Erro da API Anthropic:', erroTexto);
      return res.status(502).json({ erro: 'Não foi possível gerar a resposta agora. Tente novamente em alguns instantes.' });
    }

    const dados = await resposta.json();
    const texto = dados.content[0].text;

    return res.status(200).json({ resultado: texto });
  } catch (erro) {
    console.error('Erro no servidor:', erro);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  }
}
