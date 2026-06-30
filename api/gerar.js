// ════════════════════════════════════════════════════════════════════
// IA NO BOLSO — Backend genérico (Vercel Function)
// Protege a chave da Anthropic para TODOS os artefatos do livro
// Agora também registra cada geração no Supabase para acompanhamento.
// ════════════════════════════════════════════════════════════════════
// Rota: POST /api/gerar
// Body esperado: { "prompt": "...", "system": "..." (opcional), "artefato": "..." (opcional) }
//
// Esta única função atende aos 10 artefatos do livro (culinária,
// visagismo, finanças, CV, viagem, histórias, resumidor, diagnóstico
// de PC, culinária por perfil). Cada HTML envia seu próprio prompt
// já formatado — esta função repassa para a Anthropic com a chave
// protegida, devolve a resposta, e grava o registro no Supabase.
// ════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS precisa ser definido ANTES de qualquer verificação de método,
  // senão a requisição OPTIONS (preflight) é rejeitada sem os headers
  // e o navegador bloqueia a chamada real por política de CORS.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { prompt, system, maxTokens, artefato } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ erro: 'O campo "prompt" é obrigatório.' });
    }

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
    const tokensEntrada = dados.usage?.input_tokens || null;
    const tokensSaida = dados.usage?.output_tokens || null;

    res.status(200).json({ resultado: texto });

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      fetch(`${process.env.SUPABASE_URL}/rest/v1/geracoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          artefato: artefato || 'desconhecido',
          prompt: prompt,
          resultado: texto,
          tokens_entrada: tokensEntrada,
          tokens_saida: tokensSaida,
        }),
      }).catch(erro => console.error('Falha ao salvar geração no Supabase:', erro));
    }
  } catch (erro) {
    console.error('Erro no servidor:', erro);
    if (!res.headersSent) {
      return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
    }
  }
}
