// ════════════════════════════════════════════════════════════════════
// IA NO BOLSO — Backend genérico (Vercel Function)
// Protege a chave da Anthropic para TODOS os artefatos do livro
// Agora também registra cada geração no Supabase para acompanhamento.
// ════════════════════════════════════════════════════════════════════
// Rota: POST /api/gerar
// Body esperado: { "prompt": "...", "system": "..." (opcional), "artefato": "..." (opcional) }
//
// Esta única função atende aos 9 artefatos do livro que usam IA
// genérica (culinária x2, visagismo, finanças, CV, viagem, histórias,
// resumidor, diagnóstico de PC). Cada HTML envia seu próprio prompt já
// formatado — esta função repassa para a Anthropic com a chave
// protegida, devolve a resposta, e grava o registro no Supabase.
//
// IMPORTANTE: depois que a Vercel envia a resposta (res.json), a
// instância da função pode ser congelada a qualquer momento. Por isso
// usamos waitUntil() do pacote @vercel/functions — ele garante que o
// trabalho em segundo plano (salvar no Supabase, estruturar o JSON)
// termine de rodar antes da função ser encerrada, sem atrasar a
// resposta que o leitor vê na tela.
// ════════════════════════════════════════════════════════════════════

import { waitUntil } from '@vercel/functions';

// Aumenta o limite do body parser para aceitar imagens em base64
// O padrão da Vercel é 4.5 MB — imagens podem ultrapassar facilmente
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

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
    const { prompt, system, maxTokens, artefato, imagem } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ erro: 'O campo "prompt" é obrigatório.' });
    }

    if (prompt.length > 8000) {
      return res.status(400).json({ erro: 'Texto muito longo. Reduza o conteúdo e tente novamente.' });
    }

    // Monta o conteúdo da mensagem — com ou sem imagem
    // Se o frontend enviar { imagem: { base64: "...", mediaType: "image/jpeg" } },
    // a IA recebe a foto e o prompt junto (visão computacional).
    let mensagemConteudo;
    if (imagem && imagem.base64 && imagem.mediaType) {
      mensagemConteudo = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imagem.mediaType,
            data: imagem.base64,
          },
        },
        { type: 'text', text: prompt },
      ];
    } else {
      mensagemConteudo = prompt;
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
        messages: [{ role: 'user', content: mensagemConteudo }],
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

    // Tudo daqui pra baixo roda DEPOIS da resposta já ter sido enviada ao
    // leitor — falhas aqui nunca afetam a experiência de quem está usando
    // o artefato, só deixam de registrar o histórico. waitUntil() garante
    // que a Vercel mantenha a função viva até esse trabalho terminar.
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      waitUntil(
        registrarGeracao({
          artefato: artefato || 'desconhecido',
          prompt,
          resultado: texto,
          tokensEntrada,
          tokensSaida,
        }).catch(erro => console.error('Falha ao salvar geração no Supabase:', erro))
      );
    }

    async function registrarGeracao({ artefato, prompt, resultado, tokensEntrada, tokensSaida }) {
      // 1) Grava o registro genérico e pede de volta o id criado
      const respGeracao = await fetch(`${process.env.SUPABASE_URL}/rest/v1/geracoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          artefato,
          prompt,
          resultado,
          tokens_entrada: tokensEntrada,
          tokens_saida: tokensSaida,
        }),
      });

      if (!respGeracao.ok) {
        console.error('Supabase recusou o insert em geracoes:', await respGeracao.text());
        return;
      }

      const geracaoSalva = await respGeracao.json();
      const geracaoId = Array.isArray(geracaoSalva) ? geracaoSalva[0]?.id : geracaoSalva?.id;

      // 2) Se o artefato tem extração estruturada configurada, gera o JSON
      //    com uma segunda chamada curta à Anthropic e grava na tabela dele
      const config = EXTRACAO_CONFIG[artefato];
      if (geracaoId && config) {
        try {
          const estruturado = await extrairEstruturado(resultado, config.modeloJson, config.instrucao);
          if (estruturado) {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/${config.tabela}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                geracao_id: geracaoId,
                artefato,
                ...estruturado,
              }),
            });
          }
        } catch (erroEstrutura) {
          console.error(`Falha ao estruturar/salvar "${artefato}":`, erroEstrutura);
        }
      }
    }

    // Pede para a IA reformular o texto já gerado como JSON estrito, só
    // para fins de armazenamento estruturado (não é exibido ao leitor).
    async function extrairEstruturado(textoOriginal, modeloJson, instrucao) {
      const respExtra = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 900,
          system: 'Você extrai dados de um texto e devolve SOMENTE um JSON válido, sem texto antes ou depois, sem blocos de markdown.',
          messages: [{
            role: 'user',
            content: `${instrucao}\n\nFormato JSON exato:\n${modeloJson}\n\nTEXTO ORIGINAL:\n${textoOriginal}`,
          }],
        }),
      });

      if (!respExtra.ok) return null;

      const dadosExtra = await respExtra.json();
      let textoJson = dadosExtra.content[0].text.trim();
      textoJson = textoJson.replace(/```json|```/g, '').trim();

      try {
        return JSON.parse(textoJson);
      } catch {
        console.error('Não foi possível interpretar o JSON estruturado:', textoJson);
        return null;
      }
    }
  } catch (erro) {
    console.error('Erro no servidor:', erro);
    if (!res.headersSent) {
      return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// Configuração de extração estruturada por artefato.
// Cada entrada diz: em qual tabela do Supabase salvar, e qual JSON
// pedir à IA para extrair do texto que ela mesma gerou.
// Artefatos sem entrada aqui só são salvos em "geracoes" (texto bruto).
// ════════════════════════════════════════════════════════════════════
const EXTRACAO_CONFIG = {
  '01_culinaria': {
    tabela: 'receitas',
    instrucao: 'Extraia os dados da receita abaixo.',
    modeloJson: `{
  "nome_receita": "string",
  "porcoes": "string ou null",
  "tempo_preparo": "string ou null",
  "ingredientes": [{ "item": "string", "quantidade": "string" }],
  "modo_preparo": [{ "ordem": 1, "etapa": "string", "tempo": "string ou null" }],
  "dica_ponto": "string ou null",
  "observacoes": "string ou null"
}`,
  },
  '02_culinaria_perfil': {
    tabela: 'receitas',
    instrucao: 'Extraia os dados da receita abaixo.',
    modeloJson: `{
  "nome_receita": "string",
  "porcoes": "string ou null",
  "tempo_preparo": "string ou null",
  "ingredientes": [{ "item": "string", "quantidade": "string" }],
  "modo_preparo": [{ "ordem": 1, "etapa": "string", "tempo": "string ou null" }],
  "dica_ponto": "string ou null",
  "observacoes": "string ou null"
}`,
  },
  '03_diagnostico_pc': {
    tabela: 'diagnosticos_pc',
    instrucao: 'Extraia o diagnóstico técnico abaixo.',
    modeloJson: `{
  "problema_resumo": "string",
  "causas_provaveis": [{ "causa": "string", "probabilidade": "alta|média|baixa" }],
  "solucoes": [{ "ordem": 1, "solucao": "string", "tempo": "string ou null", "risco": "string ou null" }],
  "alerta_backup": "string ou null",
  "quando_assistencia": "string ou null"
}`,
  },
  '04_financas': {
    tabela: 'analises_financeiras',
    instrucao: 'Extraia a análise financeira abaixo.',
    modeloJson: `{
  "renda_liquida": 0,
  "categorias": [{ "categoria": "string", "valor": 0, "percentual": 0 }],
  "rombos_ocultos": [{ "gasto": "string", "valor_estimado": 0 }],
  "plano_corte": "string ou null",
  "meta_economia": 0,
  "prazo_estimado": "string ou null"
}`,
  },
  '05_resumidor': {
    tabela: 'resumos',
    instrucao: 'Extraia os 5 níveis de resumo abaixo.',
    modeloJson: `{
  "tema": "string ou null",
  "frase_unica": "string",
  "paragrafo": "string",
  "pontos_chave": ["string"],
  "versao_leigo": "string",
  "versao_decisao": "string",
  "info_nao_capturada": "string ou null"
}`,
  },
  '06_cv': {
    tabela: 'curriculos',
    instrucao: 'Extraia os dados do currículo reescrito abaixo.',
    modeloJson: `{
  "vaga_alvo": "string ou null",
  "analise_match": "string ou null",
  "objetivo_reescrito": "string ou null",
  "experiencias": [{ "cargo": "string", "descricao_reescrita": "string" }],
  "carta_apresentacao": "string ou null"
}`,
  },
  '07_historias': {
    tabela: 'historias_infantis',
    instrucao: 'Extraia os dados da história infantil abaixo.',
    modeloJson: `{
  "nome_crianca": "string ou null",
  "idade": 0,
  "valor_mensagem": "string ou null",
  "cenas": [{ "ordem": 1, "texto": "string", "entonacao": "string ou null" }],
  "tempo_leitura": "string ou null"
}`,
  },
  '08_viagem': {
    tabela: 'planejamentos_viagem',
    instrucao: 'Extraia o roteiro de viagem abaixo.',
    modeloJson: `{
  "destino": "string ou null",
  "dias": 0,
  "orcamento": 0,
  "roteiro": [{ "dia": 1, "manha": "string", "tarde": "string", "noite": "string" }],
  "hospedagem_sugestoes": [{ "bairro": "string", "motivo": "string" }],
  "restaurantes": [{ "nome": "string", "faixa_preco": "string", "prato": "string" }],
  "erro_comum": "string ou null"
}`,
  },
  '09_visagismo': {
    tabela: 'analises_visagismo',
    instrucao: 'Extraia a análise de visagismo abaixo.',
    modeloJson: `{
  "formato_rosto": "string ou null",
  "justificativa": "string ou null",
  "cortes_recomendados": [{ "nome_tecnico": "string", "motivo": "string" }],
  "cortes_evitar": "string ou null",
  "recomendacao_franja": "string ou null"
}`,
  },
};
