# App de Gestão de Fazenda — Design do Produto

## Objetivo

Construir uma aplicação web responsiva para gestão de bovinos, utilizável no celular e no computador. O primeiro cliente terá uma fazenda, mas o modelo permitirá múltiplas propriedades e futuras contas isoladas. O proprietário do software operará o serviço e cobrará mensalidade por hospedagem, backup, suporte e atualizações.

A primeira versão comercial termina quando o cliente consegue controlar o rebanho e o ciclo reprodutivo completo, incluindo indicadores confiáveis. Sanidade, desempenho, relatórios finais e operação offline entram em entregas posteriores.

## Escopo aprovado

- Bovinos apenas, com administrador e operador.
- Cadastro de propriedades, pastos, grupos de manejo e animais.
- Brinco único entre animais ativos da mesma conta, reutilizável depois da baixa.
- Categorias sugeridas por regras configuráveis de sexo, idade e histórico reprodutivo.
- Histórico de movimentações, pesagens, reprodução, sanidade e baixas.
- Monta natural, inseminação, diagnóstico, gestação, aborto, parto e vínculo mãe-cria.
- Campanhas sanitárias e aplicações individuais ou coletivas, sem estoque de medicamentos.
- Venda, óbito, pesagem, desmama, pirâmide etária, indicadores e exportações CSV/XLSX.
- Alertas dentro do sistema.
- Piloto gradual antes de migrar todo o rebanho.

Ficam fora da primeira versão: gestão financeira completa, documentos oficiais/GTA, RFID, fotos, aplicativos nativos, WhatsApp, e-mail, estoque veterinário e outras espécies.

## Alternativas consideradas

### Aplicação React/Vite com Supabase — escolhida

Uma SPA responsiva reduz a infraestrutura necessária, funciona bem para um painel autenticado e pode ser hospedada estaticamente. PostgreSQL, autenticação e autorização permanecem gerenciados no Supabase. A abordagem cabe no orçamento inicial e mantém uma única base para celular e computador.

### Next.js full-stack

Oferece servidor e frontend no mesmo framework, mas adiciona uma camada de execução que o produto autenticado não precisa no início. Também aumenta as decisões de hospedagem sem trazer benefício relevante de SEO.

### Aplicativo móvel nativo com API separada

Entregaria controle offline mais cedo, mas duplicaria interfaces e elevaria custo e manutenção. Foi descartado porque o MVP pode operar online e o offline foi explicitamente adiado.

## Arquitetura

### Frontend

- React, TypeScript e Vite.
- React Router para rotas autenticadas.
- TanStack Query para estado remoto e invalidação de cache.
- React Hook Form e Zod para formulários e validação compartilhada.
- Tailwind CSS e componentes acessíveis baseados em shadcn/ui.
- Organização por funcionalidade: autenticação, propriedades, rebanho, reprodução, sanidade, pesagens, relatórios e configurações.
- Manifesto PWA desde o início; cache de dados e sincronização offline permanecem desativados até a etapa específica.

### Dados e serviços

- Supabase Auth com e-mail e senha.
- PostgreSQL gerenciado pelo Supabase.
- Migrações SQL versionadas no repositório e tipos TypeScript gerados do schema.
- Row Level Security em toda tabela, view ou função exposta.
- Funções PostgreSQL transacionais para operações que alteram vários registros: nascimento, baixa coletiva, movimentação coletiva, aplicação de campanha e cancelamento/substituição de eventos.
- Edge Functions somente para rotinas que precisem de segredo no servidor ou processamento agendado; não haverá API própria separada no MVP.

### Hospedagem e operação

- Frontend estático no Cloudflare Pages.
- Projeto Supabase gratuito durante desenvolvimento e plano com backup automático antes de inserir o rebanho completo.
- Ambientes separados de desenvolvimento e produção.
- Backup lógico externo periódico além do backup gerenciado.
- Logs de erros sem dados sensíveis e monitoramento da disponibilidade.

## Modelo de domínio

### Conta e acesso

- `accounts`: unidade de isolamento dos dados.
- `memberships`: relação do usuário com a conta e papel `admin` ou `operator`.
- `farms`: propriedades da conta.
- `paddocks`: pastos de uma propriedade.
- `management_groups`: lotes ou grupos de manejo.

O administrador gerencia usuários, propriedades e configurações e também pode executar rotinas. O operador cadastra e altera dados operacionais, mas não remove definitivamente registros históricos. Inicialmente, todos os membros da conta acessam todas as suas propriedades.

### Animal e identificação

Cada animal possui UUID permanente, conta, propriedade atual, brinco, sexo, data de nascimento, marcador de data estimada, raça opcional, categoria calculada, possível substituição manual da categoria, grupo/pasto atual e situação `active`, `sold` ou `dead`.

Um índice parcial garante unicidade do brinco normalizado por conta somente enquanto o animal estiver ativo. Reutilizar um brinco após baixa cria outro animal com novo UUID; nenhum histórico é transferido.

### Eventos e auditoria

Movimentações, pesagens, eventos reprodutivos, aplicações sanitárias e baixas são registros históricos. Não são apagados. Uma correção marca o evento anterior como cancelado, registra motivo, autor e data e cria um substituto quando necessário.

Toda operação mutável registra autor, criação e atualização. Comandos coletivos e futuros comandos offline aceitam uma chave de idempotência para evitar duplicação em reenvios.

### Reprodução e genealogia

- Métodos: monta natural e inseminação.
- Reprodutor ou sêmen: opcional.
- Diagnóstico: positivo, negativo ou inconclusivo.
- Previsão de parto: data da cobertura/inseminação mais duração configurável, iniciando em 283 dias; uma gestação pode receber ajuste individual.
- Parto registrado no sistema cria o evento e a cria na mesma transação.
- A mãe é obrigatória para nascimentos internos e opcional para animais importados; o pai é opcional.
- Aborto encerra a gestação sem criar uma cria.

Indicadores usam somente eventos não cancelados:

- Intervalo entre partos: diferença em dias entre partos consecutivos da matriz.
- Dias vazia encerrados: diferença entre o parto e a concepção posteriormente confirmada.
- Dias vazia atuais: diferença entre o último parto e a data do relatório quando não existe concepção confirmada.
- Animais sem datas confiáveis aparecem como “sem dados suficientes” e não entram silenciosamente nas médias.

### Pesagem, desmama e idade

Qualquer pesagem pode ser registrada. Pesagens de nascimento e desmama recebem tipos próprios. A desmama referencia a cria e permite análise agregada pela mãe.

A idade é calculada da data de nascimento até a data consultada. Datas estimadas permanecem identificadas nos relatórios. A pirâmide etária começa com faixas de 0–12, 13–24, 25–36, 37–60 e 61+ meses, configuráveis pela conta.

### Sanidade

Uma campanha possui nome, doença ou finalidade, produto, lote do produto, dose, datas, responsável e filtros de público-alvo. Os filtros abrangem propriedade, sexo, idade, categoria, grupo e pasto. Cada aplicação confirma animal, data, dose e aplicador. Brucelose é um modelo configurável, não uma regra legal fixa no código.

### Baixas

Venda registra data, comprador, valor, peso e observação. Óbito registra data, causa e observação. A baixa altera a situação do animal e libera o número do brinco, preservando todos os vínculos históricos.

## Fluxo de dados e erros

O frontend valida formato e campos obrigatórios antes do envio. O banco repete as invariantes críticas com constraints, índices, RLS e funções transacionais. Erros esperados retornam códigos estáveis para mensagens em português, como brinco duplicado, gestação já encerrada, animal inativo ou acesso negado.

Operações coletivas são atômicas quando todos os itens devem ter o mesmo resultado. Quando a rotina permitir sucesso parcial, a tela mostra uma prévia e exige correção dos itens inválidos antes da confirmação, evitando lotes parcialmente aplicados no MVP.

## Segurança e privacidade

- Nenhum dado operacional será público ou acessível anonimamente.
- Políticas RLS verificarão a associação do usuário à conta em todas as operações.
- Chaves administrativas permanecem apenas em ambientes de servidor ou automação.
- Exportações respeitam os mesmos filtros de conta das consultas.
- Comprador e usuário são os únicos dados pessoais esperados; coleta será limitada ao necessário para a operação.

## Estratégia de testes

- Testes unitários para normalização de brinco, categorias, idade, previsão de parto e indicadores reprodutivos.
- Testes de integração das constraints, funções transacionais e políticas RLS.
- Testes end-to-end dos fluxos de login, cadastro, movimentação, reprodução, campanha, pesagem, baixa e exportação.
- Teste de volume com ao menos 5 mil animais e campanhas coletivas.
- Ensaio documentado de restauração do backup antes da migração integral.
- Desenvolvimento de regras de negócio em ciclos teste-falha, implementação mínima e teste-passagem.

## Etapas de entrega

1. Fundação: projeto, CI, ambientes, autenticação, conta, propriedades, papéis, RLS, auditoria e backup.
2. Núcleo do rebanho: animais, brincos, categorias, pastos, grupos, movimentações, pesagens e baixas.
3. Reprodução comercial: ciclo completo, genealogia, alertas e indicadores; encerra o primeiro MVP vendável.
4. Sanidade: campanhas, seleção do público e aplicações em lote.
5. Desempenho e relatórios: desmama, curvas de peso, pirâmide etária e CSV/XLSX.
6. Piloto: subconjunto real, conferência manual, importação validada, treinamento e migração integral.
7. Offline: armazenamento local, fila, sincronização, idempotência e tratamento explícito de conflitos.

## Critérios de aceite do primeiro MVP

- Administrador convida operador e ambos acessam apenas sua conta.
- Brinco ativo duplicado é rejeitado em toda a conta; brinco de animal baixado pode ser reutilizado.
- O histórico de um animal continua íntegro após movimentação, correção ou baixa.
- Nascimento cria cria e vínculo materno atomicamente.
- Gestação, parto, aborto, intervalo entre partos e dias vazia produzem os resultados conferidos com uma amostra real.
- Eventos incompletos não contaminam indicadores e são identificados como sem dados.
- Interface funciona nos tamanhos de tela de celular e computador.
- Testes automatizados, build de produção e restauração de backup passam antes do uso integral.

## Convenções

- Idioma: português do Brasil.
- Datas exibidas: `dd/MM/aaaa`.
- Fuso: `America/Sao_Paulo`.
- Peso: quilogramas.
- Moeda: BRL.
- Código e identificadores técnicos: inglês; textos da interface: português.
