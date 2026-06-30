// ════════════════════════════════════════════════════════════════════
// ME SURPREENDA — Backend serverless (Vercel Function)
// IA no Bolso — Paulo da Silva Filho
// ════════════════════════════════════════════════════════════════════
// Esta função roda no servidor da Vercel, NUNCA no navegador do leitor.
// A API key da Anthropic fica guardada em variável de ambiente — o
// leitor do livro nunca vê essa chave, mesmo inspecionando o código.
//
// Rota: POST /api/surpreenda
// ════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // Apenas POST é aceito
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  // CORS — permite que o site psfeditoraeconsultoria.com.br chame esta função
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { nome, idade, hobbies, comida, musica, momento, lat, lng } = req.body;

    // Validação básica
    if (!nome || !hobbies || !Array.isArray(hobbies)) {
      return res.status(400).json({ erro: 'Dados do perfil incompletos' });
    }

    // Contexto temporal — a IA usa isso para calibrar a sugestão
    const agora = new Date();
    const hora = agora.getHours();
    const periodo =
      hora < 12 ? 'manhã' : hora < 18 ? 'tarde' : hora < 22 ? 'noite' : 'madrugada';
    const diasSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
    const diaSemana = diasSemana[agora.getDay()];

    const temLocalizacao = lat && lng && lat !== 0 && lng !== 0;
    const infoLocalizacao = temLocalizacao
      ? `Localização GPS do usuário: latitude ${lat}, longitude ${lng}. Use essa localização para estimar a região/cidade brasileira e sugerir lugares plausíveis nessa área.`
      : 'Localização não disponível — faça sugestões genéricas que funcionem em qualquer cidade brasileira de médio/grande porte.';

    const prompt = `Você é um assistente especializado em criar experiências personalizadas e surpreendentes para o livro "IA no Bolso".

PERFIL DO LEITOR:
Nome: ${nome}, ${idade || 'idade não informada'} anos
Hobbies: ${hobbies.join(', ')}
Comida preferida: ${comida || 'qualquer tipo'}
Música preferida: ${musica || 'qualquer estilo'}
Momento atual: ${momento || 'não informado'}
Horário: ${periodo} de ${diaSemana}
${infoLocalizacao}

Crie EXATAMENTE 3 sugestões de experiências surpreendentes e personalizadas para ${nome} AGORA.

Responda SOMENTE com um JSON válido nesta estrutura exata, sem texto antes ou depois:
[
  {
    "emoji": "🍖",
    "tipo": "Gastronomia",
    "titulo": "Nome do lugar ou experiência",
    "descricao": "Descrição em até 2 linhas explicando por que é perfeito para esse perfil agora",
    "busca": "termo para buscar no Google Maps, ex: restaurante baiano"
  }
]

REGRAS:
- As 3 sugestões devem ser de categorias DIFERENTES (não repita o mesmo tipo)
- Cada sugestão deve estar claramente conectada ao perfil e ao momento informado
- Use o horário (${periodo}) para calibrar o tom da sugestão
- Seja específico, criativo e genuinamente surpreendente — evite sugestões óbvias
- O campo "busca" deve ser um termo de busca real e útil para o Google Maps`;

    // Chamada à API da Anthropic — a chave fica só aqui, no servidor
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: 'Você cria sugestões de experiências personalizadas para um livro brasileiro. Responda SOMENTE com JSON válido, sem nenhum texto adicional antes ou depois.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resposta.ok) {
      const erroTexto = await resposta.text();
      console.error('Erro da API Anthropic:', erroTexto);
      return res.status(502).json({ erro: 'Falha ao gerar sugestões. Tente novamente.' });
    }

    const dados = await resposta.json();
    let textoResposta = dados.content[0].text.trim();

    // Remove eventuais blocos de markdown que a IA possa adicionar
    textoResposta = textoResposta.replace(/```json|```/g, '').trim();

    let sugestoes;
    try {
      sugestoes = JSON.parse(textoResposta);
    } catch (parseErro) {
      console.error('Erro ao interpretar resposta da IA:', textoResposta);
      // Fallback de segurança — nunca deixa o leitor sem resposta
      sugestoes = [
        {
          emoji: '🍴',
          tipo: 'Gastronomia',
          titulo: 'Restaurante local surpreendente',
          descricao: 'Explore a gastronomia da sua região com algo que combine com o seu momento agora.',
          busca: 'restaurante bem avaliado perto de mim',
        },
        {
          emoji: '🎵',
          tipo: 'Cultura',
          titulo: 'Experiência cultural próxima',
          descricao: 'Um evento ou espaço cultural que combina com seus gostos.',
          busca: 'eventos culturais hoje perto de mim',
        },
        {
          emoji: '🌿',
          tipo: 'Lazer',
          titulo: 'Passeio ao ar livre',
          descricao: 'Um parque ou área verde para renovar as energias.',
          busca: 'parque ou área verde perto de mim',
        },
      ];
    }

    return res.status(200).json({ sugestoes, periodo, diaSemana });
  } catch (erro) {
    console.error('Erro no servidor:', erro);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente em alguns instantes.' });
  }
}
