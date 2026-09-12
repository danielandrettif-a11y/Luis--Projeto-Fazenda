# Gestão da Fazenda

Aplicação web responsiva para gestão de propriedades rurais, com autenticação, isolamento por conta e papéis de administrador e operador.

## Pré-requisitos

- Node.js 24
- npm 11
- Um projeto Supabase de desenvolvimento

## Configuração local

Instale as dependências:

```powershell
npm install
```

Crie o arquivo local de configuração a partir do exemplo:

```powershell
Copy-Item .env.example .env.local
```

No Linux ou macOS, use `cp .env.example .env.local`. Edite `.env.local` com os valores públicos do projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Essas são configurações públicas do cliente. Nunca coloque a chave `service_role` no frontend, no repositório ou nas variáveis de build do Cloudflare Pages.

Inicie o ambiente de desenvolvimento:

```powershell
npm run dev
```

Antes de enviar mudanças, execute a verificação completa:

```powershell
npm run check
```

## Banco de dados no Supabase

A migração da fundação está em `supabase/migrations/202609120001_foundation.sql`. Para preparar um projeto Supabase de desenvolvimento:

1. Crie ou selecione um projeto destinado exclusivamente ao desenvolvimento.
2. Abra o SQL Editor no painel do Supabase.
3. Copie todo o conteúdo da migração e execute-o uma única vez no projeto vazio.
4. Confirme que as tabelas, funções, permissões e políticas RLS foram criadas sem erros.
5. Use a URL e a chave anônima pública desse projeto no arquivo `.env.local`.

Mantenha projetos e credenciais separados para desenvolvimento e produção. Alterações futuras de schema devem ser adicionadas como novas migrações versionadas.

## Publicação no Cloudflare Pages

Conecte o repositório ao Cloudflare Pages e configure:

- Comando de build: `npm run build`
- Diretório de saída: `dist`
- Versão do Node.js: `24`
- `VITE_SUPABASE_URL`: URL pública do projeto Supabase do ambiente
- `VITE_SUPABASE_ANON_KEY`: chave anônima pública do mesmo projeto

O arquivo `public/_redirects` encaminha rotas da SPA para `index.html`. O projeto publica metadados PWA, mas não registra service worker e não mantém dados autenticados em cache offline.

## Backups

Antes de usar dados reais em produção, habilite um plano Supabase com backups gerenciados e mantenha também backups lógicos externos periódicos, armazenados fora do provedor principal. Defina e teste um procedimento de restauração; o backup gerenciado, sozinho, não substitui uma cópia externa verificável.
