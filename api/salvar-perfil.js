// ════════════════════════════════════════════════════════════════════
// ME SURPREENDA — Salvar perfil e histórico no Supabase
// IA no Bolso — Paulo da Silva Filho
// ════════════════════════════════════════════════════════════════════
// Rota: POST /api/salvar-perfil
// Esta função salva/atualiza o perfil do leitor e registra cada
// conjunto de sugestões no histórico — para nunca repetir a mesma
// surpresa duas vezes para a mesma pessoa.
// ════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    const { deviceId, nome, idade, hobbies, comida, musica, momento, lat, lng, sugestoes } = req.body;

    if (!deviceId) {
      return res.status(400).json({ erro: 'deviceId é obrigatório' });
    }

    // 1) Criar ou atualizar o perfil (upsert pelo device_id)
    const perfilResp = await fetch(`${SUPABASE_URL}/rest/v1/perfis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        device_id: deviceId,
        nome,
        idade,
        hobbies,
        comida,
        musica,
        atualizado_em: new Date().toISOString(),
      }),
    });

    const perfilData = await perfilResp.json();
    const perfilId = Array.isArray(perfilData) ? perfilData[0]?.id : perfilData?.id;

    // 2) Registrar no histórico, se as sugestões foram passadas
    if (sugestoes && perfilId) {
      await fetch(`${SUPABASE_URL}/rest/v1/sugestoes_historico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          perfil_id: perfilId,
          momento,
          latitude: lat || null,
          longitude: lng || null,
          sugestoes,
        }),
      });
    }

    return res.status(200).json({ ok: true, perfilId });
  } catch (erro) {
    console.error('Erro ao salvar no Supabase:', erro);
    // Não bloqueia o fluxo do leitor — salvar é "nice to have", não essencial
    return res.status(200).json({ ok: false, aviso: 'Não foi possível salvar o histórico, mas isso não afeta sua experiência.' });
  }
}
