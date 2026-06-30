// ════════════════════════════════════════════════════════════════════
// VISAGISMO — Endpoint dedicado para análise com imagem (Vercel Function)
// Endpoint separado do /api/gerar para isolar o tratamento de imagens
// e garantir que os headers CORS estejam presentes em QUALQUER resposta,
// inclusive em erros de parsing de body (que ocorrem antes do handler
// nas funções genéricas quando o body excede o limite da plataforma).
// ════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {

  // CORS: definidos como primeiríssima ação — antes de qualquer validação
  // ou parsing, para que erros subsequentes ainda retornem com esses headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const { imagem, cabelo, comprimento } = req.body;

    if (!imagem?.base64 || !imagem?.mediaType) {
      return res.status(400).json({ erro: 'Imagem não recebida ou incompleta.' });
    }

    const prompt = `Você é uma especialista em visagismo com formação em design facial e técnicas de cabeleireiro. Analise a foto enviada.

Cabelo atual da pessoa: ${cabelo || 'não informado'}, comprimento ${comprimento || 'não informado'}.

Entregue um laudo completo com exatamente estas seções:

1) FORMATO DO ROSTO
Identifique o formato com justificativa — cite as características faciais visíveis que levaram a essa conclusão.

2) OS 3 MELHORES CORTES
Para cada corte: nome técnico, por que valoriza esse formato, comprimento ideal, como pedir ao cabeleireiro com termos exatos.

3) CORTES A EVITAR
Liste os que prejudicam esse formato e explique exatamente por quê.

4) FRANJA
Funciona para esse formato? Qual modelo? Como equilibra as proporções?

5) ADAPTAÇÃO PARA O CABELO ATUAL
Como os cortes recomendados se adaptam ao cabelo ${cabelo || 'informado'} de comprimento ${comprimento || 'informado'}.

6) CORES QUE FAVORECEM
Se conseguir identificar o subtom de pele na foto, indique as cores de cabelo mais favoráveis com nome técnico (ex: loiro dourado acinzentado nível 8).

Use termos técnicos que a pessoa possa mostrar diretamente ao cabeleireiro.`;

    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        system: 'Você é especialista em visagismo. Responda em português do Brasil com linguagem técnica, clara e direta.',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imagem.mediaType,
                data: imagem.base64,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!resposta.ok) {
      const err = await resposta.text();
      console.error('Erro Anthropic:', err);
      return res.status(502).json({ erro: 'Não foi possível gerar a análise. Tente novamente.' });
    }

    const dados = await resposta.json();
    return res.status(200).json({ resultado: dados.content[0].text });

  } catch (erro) {
    console.error('Erro no handler de visagismo:', erro);
    // Retorna CORS mesmo no catch — garante que o browser receba a resposta
    return res.status(500).json({ erro: 'Erro interno. Tente novamente em alguns instantes.' });
  }
}
