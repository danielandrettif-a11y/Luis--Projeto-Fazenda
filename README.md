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

## Acesso somente por convite — obrigatório antes do uso

O provisionamento é administrativo. A ausência de cadastro na interface não bloqueia a API pública do Supabase. Antes de disponibilizar qualquer ambiente:

1. No painel do projeto correto, abra **Authentication → Sign In / Providers** (`https://supabase.com/dashboard/project/SEU_PROJECT_REF/auth/providers`).
2. Em **User Signups**, desative **Allow new users to sign up** e salve. Mantenha **Allow anonymous sign-ins** desativado e o provedor **Email** habilitado para login com senha. Não habilite provedores adicionais neste piloto.
3. Em **Authentication → URL Configuration**, configure **Site URL** com a origem exata do aplicativo (`http://localhost:5173` no desenvolvimento, URL HTTPS do Pages em produção). Cadastre somente os redirects necessários do mesmo ambiente.
4. Execute a verificação negativa abaixo antes de criar o primeiro usuário ou publicar o frontend. Repita em cada projeto e após mudanças de autenticação.

Desativar essa opção permite que usuários existentes continuem entrando. Consulte a [configuração oficial do Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).

### Verificação negativa do cadastro público

Com Node.js 24, `.env.local` contendo apenas URL/chave pública e um endereço de e-mail inédito sob seu controle, execute no PowerShell:

```powershell
$env:SUPABASE_SIGNUP_PROBE_EMAIL = 'endereco-inedito@seu-dominio.com'
node --env-file=.env.local --input-type=module -e '
const email = process.env.SUPABASE_SIGNUP_PROBE_EMAIL;
if (!email) throw new Error("Informe um e-mail inédito sob seu controle.");
const response = await fetch(process.env.VITE_SUPABASE_URL + "/auth/v1/signup", {
  method: "POST",
  headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: crypto.randomUUID() + "Aa1!" })
});
const body = await response.json();
if (response.ok || body.error_code !== "signup_disabled") {
  throw new Error("Cadastro público não comprovadamente bloqueado. HTTP " + response.status + "; código: " + (body.error_code ?? "ausente"));
}
console.log("OK: cadastro público bloqueado (signup_disabled).");
'
Remove-Item Env:SUPABASE_SIGNUP_PROBE_EMAIL
```

O resultado exigido é uma resposta de erro com `error_code: signup_disabled`, sem usuário/sessão. Erro de rede, CAPTCHA, limite de envio, e-mail inválido ou provedor desabilitado não comprovam a política. Em **Authentication → Users**, confirme também que o endereço testado não foi criado. Se o cadastro tiver sido aceito, mantenha o ambiente fora de uso, corrija a configuração e remova somente o usuário de teste identificado. O código está documentado na [referência de erros de Auth](https://supabase.com/docs/guides/auth/debugging/error-codes).

### Primeiro usuário autorizado

1. Após o teste negativo, abra **Authentication → Users → Add user → Create new user** no painel do projeto.
2. Informe o e-mail do administrador previamente autorizado e uma senha forte acordada por canal seguro. Confirme a identidade/endereço antes de marcar **Auto Confirm User** e criar o usuário.
3. Entregue as credenciais ao destinatário por canal seguro. Entre em `/entrar` com esse usuário e conclua a configuração inicial: o banco cria a conta, a associação `admin` e a primeira fazenda na mesma transação.
4. Saia e entre novamente para confirmar que login com senha funciona com cadastro público desativado.

O painel faz o provisionamento privilegiado sem exigir uma chave administrativa no aplicativo. Uma automação de servidor pode usar [`auth.admin.createUser`](https://supabase.com/docs/reference/javascript/auth-admin-createuser) com e-mail, senha e `email_confirm: true` somente depois da mesma verificação de identidade; a chave administrativa fica no gerenciador de segredos do servidor, nunca em `VITE_*`, `.env.local`, navegador, build, logs ou Git. Este piloto não implementa definição/recuperação de senha por link nem a tela de convite de operadores; por isso o primeiro acesso usa o provisionamento com senha descrito acima. Novos usuários autorizados devem seguir esse processo administrativo; não reative signup público.

### Supabase local opcional

Os testes automatizados de banco usam PGlite e não exigem Docker. Para executar também os serviços locais, instale a CLI Supabase e Docker conforme o [guia oficial](https://supabase.com/docs/guides/local-development/cli/getting-started), então execute `supabase start` na raiz do repositório. A CLI lê o `supabase/config.toml` versionado e aplica as migrações ao banco local inicial. Use a URL e a chave pública locais mostradas pela CLI em `.env.local`; trate a chave administrativa local como segredo e não copie a saída inteira para relatórios.

O contrato local usa `[auth].enable_signup = false`, `enable_anonymous_sign_ins = false` e `[auth.email].enable_signup = true`: esta última opção mantém o provedor de e-mail disponível para login/convite, e não reabre o cadastro global. Essa combinação foi [confirmada pelo mantenedor da CLI](https://github.com/supabase/cli/pull/4469). Se alterar o TOML com os serviços já iniciados, execute `supabase stop` e `supabase start` para aplicar a configuração, conforme a [referência da CLI](https://supabase.com/docs/guides/local-development/cli/config). Repita o teste negativo e o login do usuário provisionado no Studio local.

O TOML é configuração dos serviços locais; aplicar SQL ou publicar o frontend não altera o Auth do projeto hospedado. Os passos no painel e a verificação negativa continuam obrigatórios. O teste de contrato valida os valores TOML, mas não substitui essa verificação com o serviço em execução.

## Auditoria da fundação

Triggers do banco registram automaticamente `INSERT`, `UPDATE` e `DELETE` de contas, associações, fazendas, pastos e grupos, quando a operação é permitida. Cada evento contém conta, `auth.uid()` como ator, tipo/id da entidade e snapshots `old`/`new` da própria linha. Para associações, o id é o usuário e a identidade completa inclui a conta. Operações administrativas sem JWT têm ator nulo. Datas de criação são atribuídas e preservadas pelo banco, e `updated_at` é atualizado nas tabelas que possuem essa coluna.

Administradores leem apenas os logs de sua conta; clientes não podem inserir, editar ou apagar eventos diretamente. Mudanças de identidade ou de conta dos registros são bloqueadas para preservar a continuidade da auditoria. A retenção dos logs impede excluir definitivamente uma conta ou usuário referenciado; remoção/anonimização futura exige procedimento de retenção específico. As funções de trigger devem pertencer ao papel confiável da migração (`postgres` com BYPASSRLS), assim como o bootstrap e os helpers RLS. Não aplique a migração com um papel de cliente.

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
