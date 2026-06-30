# IA no Bolso — Artefatos para o repositório PSF-Consultoria-e-Servi-os

Este pacote foi montado para entrar **diretamente no seu repositório existente**:
`github.com/paulosilvafilhoba/PSF-Consultoria-e-Servi-os`

Seu repositório hoje tem esta estrutura (confirmada):
```
PSF-Consultoria-e-Servi-os/
├── _originais/
├── assets/
├── CNAME
├── Logo PSF-min.png
├── Logo PSF.png
├── Logo PSF2.png
├── README.md
├── autor.html
├── favicon.ico
├── favicon.png
├── foto-paulo.png
├── index.html
└── manifest.webmanifest
```

Depois de copiar este pacote, ela fica assim (itens novos marcados com ★):
```
PSF-Consultoria-e-Servi-os/
├── _originais/
├── assets/
├── ★ api/                    ← processado pela Vercel
│   ★ ├── gerar.js
│   ★ ├── surpreenda.js
│   ★ └── salvar-perfil.js
├── ★ artefatos/               ← servido pelo GitHub Pages
│   ★ ├── 01_culinaria.html
│   ★ ├── 02_culinaria_perfil.html
│   ★ ├── 03_diagnostico_pc.html
│   ★ ├── 04_financas.html
│   ★ ├── 05_resumidor.html
│   ★ ├── 06_cv.html
│   ★ ├── 07_historias.html
│   ★ ├── 08_viagem.html
│   ★ ├── 09_visagismo.html
│   ★ ├── 10_prompts.html
│   ★ └── 11_me_surpreenda.html
├── ★ sql/
│   ★ └── schema.sql           ← rodar uma vez no Supabase
├── CNAME
├── Logo PSF-min.png
├── Logo PSF.png
├── Logo PSF2.png
├── ★ vercel.json
├── ★ .vercelignore
├── ★ .gitignore
├── ★ .env.example
├── ★ package.json
├── README.md
├── autor.html
├── favicon.ico
├── favicon.png
├── foto-paulo.png
├── index.html
└── manifest.webmanifest
```

Nada do que já existe é alterado. Apenas se soma.

## Por que os artefatos ficaram leves (cada um tem ~6KB, não 1.7MB)

Os artefatos usam sua logo já existente no repositório (`Logo PSF.png`), referenciada como `../Logo%20PSF.png` — em vez de embutir a imagem em base64 dentro de cada HTML. Como os artefatos estão na pasta `artefatos/`, o `../` sobe um nível e pega a logo direto da raiz do site, exatamente onde ela já está hoje.

## Por que existe a pasta `api/` separada de `artefatos/`

GitHub Pages só serve arquivos estáticos — ele não consegue rodar código que protege sua chave de API. A pasta `api/` precisa rodar em um servidor de verdade, então ela vai para a **Vercel**, enquanto `artefatos/` continua no **GitHub Pages**, do mesmo jeito que `index.html` e `autor.html` já funcionam hoje.

```
                seu repositório no GitHub
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       GitHub Pages                   Vercel
  (como já funciona hoje:       (novo: processa
   index.html, autor.html,       somente a pasta
   e agora /artefatos/)              /api)
```

## Passo a passo

### 1. Copiar os arquivos para o seu repositório local

Clone seu repositório (se ainda não tiver localmente):
```bash
git clone https://github.com/paulosilvafilhoba/PSF-Consultoria-e-Servi-os.git
cd PSF-Consultoria-e-Servi-os
```

Copie as pastas e arquivos deste pacote para a raiz dele:
```bash
cp -r api/ artefatos/ sql/ vercel.json .vercelignore .gitignore .env.example package.json /caminho/para/PSF-Consultoria-e-Servi-os/
```

Confirme e suba:
```bash
git add .
git commit -m "Adiciona artefatos interativos e backend do livro IA no Bolso"
git push
```

O GitHub Pages republica automaticamente — em poucos minutos, `www.psfeditoraeconsultoria.com.br/artefatos/01_culinaria.html` já vai existir (mesmo que ainda sem funcionar, até o backend estar configurado).

### 2. Criar o projeto no Supabase (necessário só para o Me Surpreenda)

1. [supabase.com](https://supabase.com) → criar conta → **New Project**
2. **SQL Editor** → cole o conteúdo de `sql/schema.sql` → **Run**
3. **Settings > API** → copie a **Project URL** e a chave **anon public**

### 3. Obter a chave da Anthropic

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys** → criar nova chave
2. Copie a chave (`sk-ant-...`) — só aparece uma vez

### 4. Conectar o MESMO repositório na Vercel

1. [vercel.com](https://vercel.com) → criar conta (pode usar login do GitHub)
2. **Add New Project** → **Import Git Repository** → escolha `PSF-Consultoria-e-Servi-os`
3. A Vercel detecta o `vercel.json` automaticamente e processa só `api/` — o `.vercelignore` garante que ela ignore o resto do site
4. Ao final, você recebe uma URL — algo como:
   ```
   https://psf-consultoria-backend.vercel.app
   ```
   (o nome exato depende do que estiver disponível; a Vercel mostra antes de confirmar)

### 5. Se a URL final for diferente da usada nos arquivos

Os 10 artefatos com IA já vêm configurados com:
```js
const BACKEND_URL = 'https://psf-consultoria-backend.vercel.app';
```

Se a Vercel te der uma URL diferente, troque essa linha nos 10 arquivos (não precisa no `10_prompts.html`, que não usa backend). É a mesma linha em todos — pode usar busca e substituição em qualquer editor de texto, ou rodar:
```bash
cd artefatos
sed -i '' 's|psf-consultoria-backend.vercel.app|SUA-URL-REAL.vercel.app|g' *.html
```

### 6. Configurar as variáveis de ambiente na Vercel

No projeto da Vercel → **Settings > Environment Variables**:

| Nome | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | sua chave `sk-ant-...` |
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_ANON_KEY` | chave anon public do Supabase |

Depois de salvar, force um redeploy na Vercel para aplicar.

### 7. Testar

No celular, acesse:
```
https://www.psfeditoraeconsultoria.com.br/artefatos/01_culinaria.html
```
Preencha os ingredientes, gere a receita, confirme que a logo aparece corretamente (puxada da raiz do site) e que a resposta da IA chega.

Para o Me Surpreenda, confirme também que o perfil aparece em **Supabase > Table Editor > perfis**.

## Custos

- **GitHub Pages**: gratuito (você já usa)
- **Vercel**: gratuito até 100GB de banda/mês
- **Supabase**: gratuito até 500MB e 50.000 usuários ativos/mês
- **Anthropic API**: cobrança por uso — poucos centavos por centena de gerações
