-- ════════════════════════════════════════════════════════════════════
-- ME SURPREENDA — Schema do Supabase
-- IA no Bolso — Paulo da Silva Filho
-- ════════════════════════════════════════════════════════════════════
-- Como usar:
-- 1. Acesse https://supabase.com e crie um novo projeto (gratuito)
-- 2. Vá em "SQL Editor" no menu lateral
-- 3. Cole este arquivo inteiro e clique em "Run"
-- 4. Copie a URL e a chave "anon public" em Settings > API
-- ════════════════════════════════════════════════════════════════════

-- Tabela de perfis dos leitores
create table if not exists perfis (
  id uuid primary key default gen_random_uuid(),
  device_id text unique not null,        -- identificador anônimo do dispositivo (gerado no navegador)
  nome text,
  idade int,
  hobbies text[],                        -- array com até 3 hobbies
  comida text,
  musica text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Histórico de sugestões já entregues (evita repetir a mesma surpresa)
create table if not exists sugestoes_historico (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references perfis(id) on delete cascade,
  momento text,                          -- estado de humor escolhido na hora
  latitude numeric,
  longitude numeric,
  sugestoes jsonb not null,              -- as 3 sugestões geradas, guardadas como JSON
  criado_em timestamptz default now()
);

-- Índices para consultas rápidas
create index if not exists idx_perfis_device on perfis(device_id);
create index if not exists idx_historico_perfil on sugestoes_historico(perfil_id);
create index if not exists idx_historico_data on sugestoes_historico(criado_em desc);

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — protege os dados de outros usuários
-- ════════════════════════════════════════════════════════════════════
alter table perfis enable row level security;
alter table sugestoes_historico enable row level security;

-- Qualquer pessoa pode criar/ler seu próprio perfil pelo device_id
-- (o controle de "qual é o seu" é feito pelo device_id gerado no navegador,
--  não há login, então a policy é aberta para inserir/ler/atualizar)
create policy "Perfis: insert público" on perfis
  for insert with check (true);

create policy "Perfis: select público" on perfis
  for select using (true);

create policy "Perfis: update público" on perfis
  for update using (true);

create policy "Histórico: insert público" on sugestoes_historico
  for insert with check (true);

create policy "Histórico: select público" on sugestoes_historico
  for select using (true);

-- ════════════════════════════════════════════════════════════════════
-- Pronto! Depois de rodar este script, vá em:
-- Settings > API  →  copie "Project URL" e "anon public" key
-- Cole esses dois valores no arquivo .env do backend (ver README.md)
-- ════════════════════════════════════════════════════════════════════
