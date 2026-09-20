# apps-para-maes

Linha de pequenos aplicativos web gratuitos para mães. Projeto pessoal da Simone,
separado da empresa onde ela trabalha. Primeiro app: **Semana de Prova**.

Fale sempre em português do Brasil, com explicações equilibradas: nem longas
demais, nem secas.

**Leia também [`semana-de-prova/PRODUTO.md`](semana-de-prova/PRODUTO.md)**, que
descreve o app do ponto de vista de quem usa (propósito, jornada da mãe e da
criança, regras do roteiro e do quiz). Ele é a referência de intenção: nenhuma
mudança pode contrariá-lo sem aprovação da Simone, e quando uma funcionalidade
mudar, ele é atualizado no mesmo commit.

## 1. O que é o Semana de Prova

A mãe (ou a criança) envia o comunicado da escola com as provas da semana e o
material de estudo — fotos das páginas, PDF, Word, texto colado, link de vídeo.
A IA extrai as provas, monta um roteiro de estudo por dia até cada prova, explica
o conteúdo em linguagem de criança e gera quiz de reforço. O que a criança erra
volta na revisão da véspera.

Uso real: dois filhos da Simone, 4º e 5º ano, cada um com seu perfil.
Objetivo de curto prazo: validar numa semana de provas e distribuir para as mães
da turma, que são leigas em tecnologia.

## 2. Estado atual

- Repositório: `github.com/sivicentes/apps-para-maes` (público, GitHub Pages).
  Uma pasta por app; `index.html` na raiz será a vitrine (ainda não existe).
- App: `semana-de-prova/index.html`. Arquivo único, HTML + CSS + JS puro, sem
  build, ~72 KB.
- URL esperada: `https://sivicentes.github.io/apps-para-maes/semana-de-prova/`
- A IA é o Gemini, chamado direto do navegador. A chave é colada pela usuária na
  aba "Pais" e fica só no `localStorage` do aparelho.
- **Nunca foi testado contra o Gemini real.** Tudo foi validado só com API
  simulada (jsdom + fetch falso). O primeiro teste real é a prioridade nº 1.

## 3. Mapa do código (`semana-de-prova/index.html`)

Armazenamento (`localStorage`):

- `semana-de-prova:v1` → estado do app. É o que entra na cópia de segurança.
- `semana-de-prova:gemini` → `{key, models[], model}`. Fica fora da cópia de
  segurança de propósito.

Formato do estado:

```
S = { v:1, active: kidId, settings:{minutes, weekends},
      kids:[{ id, name, grade, planAt,
        exams:[{ id, subject, date(AAAA-MM-DD), topics, pages,
                 links:[{url,label,read}], content(texto, máx 16000), nPages,
                 misses:[{q,topic}], asked:[enunciados] }],
        sessions:[{ id, examId, date, type:"estudo"|"revisao", title, minutes,
                    steps:[{t,done}], done, explain, score:{right,total,at} }] }] }
```

Blocos principais:

- **Camada de IA**: `connectGemini`, `rankModels`, `gemini(prompt, opts, wantJson)`,
  `makeSample()` (expõe `sample()`, `sample.json()`, `sample.limits()`),
  `parseLoose`. Tenta até 4 modelos em sequência quando recebe 404/429/5xx.
- **Arquivos**: `gather` (roteia), `shrink` (reduz fotos para 1600 px),
  `pdfParts` (pdf.js 3.11.174 via cdnjs, carregado sob demanda, texto primeiro e
  imagem como plano B, captura links das anotações), `docxParts` (JSZip 3.10.1 via
  cdnjs, extrai texto, tabelas, hyperlinks do `.rels` e imagens embutidas).
- **Fluxos**: `readNotice` (comunicados, fila de vários arquivos, deduplica por
  matéria+data e mescla links), `readPages`, `readVideo` (YouTube via
  `file_data.file_uri`), `makePlan(onlyId?)` (roteiro geral ou de uma prova só,
  respeitando minutos já ocupados no dia), `basicSessions` (roteiro simples sem
  IA), `explain`, `fetchQuiz` / `startQuiz` / `finishQuiz` (quiz pré-carregado
  quando a criança conclui os passos).
- **Interface**: funções `v*` devolvem HTML em string; `render()` redesenha tudo;
  ações no objeto `A`, disparadas por delegação em `[data-a]`; `keepForm()`
  preserva campos entre renders; `confirmBox` substitui o `confirm()` nativo;
  `toast` fica fora do `#app`.
- **Visual**: tokens CSS em `:root` com modo escuro, fontes Baloo 2 + Nunito
  (Google Fonts), efeito de marca-texto amarelo como assinatura, navegação
  inferior com 3 abas (Hoje, Provas, Pais). Mobile first, com safe-area.

## 4. Fatos sobre o Gemini verificados em 20/09/2026 (confira de novo, muda rápido)

- O AI Studio agora emite chaves que começam com `AQ.` (antes `AIza`). Elas
  exigem o cabeçalho `x-goog-api-key`. Há relatos de falha com `?key=` na URL e
  no endpoint compatível com OpenAI. O app já usa o cabeçalho.
- Endpoint usado:
  `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`.
  Existe uma "Interactions API" mais nova, em beta; a documentação recomenda
  `generateContent` para produção estável.
- Modelo atual na documentação: `gemini-3.8-flash`. O nível gratuito cobre só a
  família Flash. O app lista os modelos da chave e escolhe sozinho; se o mais
  novo não estiver no gratuito, cai para o seguinte.
- YouTube: a URL pública vai em `file_data.file_uri`. Recurso em preview, só
  vídeos públicos, limite de 8 horas de vídeo por dia no gratuito.
- Cota é por projeto do Google Cloud, não por chave. Há um projeto dedicado a
  este app.
- No nível gratuito o Google pode usar o conteúdo enviado para treinar modelos.
  No pago, não.

## 5. Decisões já tomadas (não reabrir sem motivo)

1. Arquivo único, sem framework e sem build, enquanto for possível. Estruturas
   enxutas que dê para sofisticar depois.
2. Dados da criança (nome, progresso, notas, erros) ficam só no aparelho. O nome
   nunca vai para a IA; só a série.
3. O material lido é guardado como resumo condensado de estudo, nunca como cópia
   integral de página de livro (direito autoral).
4. Nada de ferramentas intermediárias tipo n8n ou Make. Integrações nativas e
   serviços gratuitos (GitHub Pages, Cloudflare).
5. As mães não podem precisar criar conta nem chave de IA.
6. Material compartilhado por turma: a primeira mãe cadastra e processa, as
   outras recebem pronto.

## 6. Roteiro de trabalho

**Fase 1, agora: validar com o Gemini real.**

- Servidor local simples na pasta do repositório; a Simone abre no navegador e
  cola a chave. Nunca peça, leia nem grave a chave.
- Testar nesta ordem: salvar chave, ler comunicado (foto, PDF, .docx, texto),
  enviar fotos de páginas, ler vídeo do YouTube, montar roteiro de uma prova,
  explicação, quiz.
- Corrigir o que quebrar: CORS, nome de modelo, formato da resposta, tamanho de
  imagem, tempo de espera. Dizer a causa em uma frase antes de mexer.
- Recriar uma suíte mínima de testes de fumaça em `semana-de-prova/tests/`
  (jsdom com fetch simulado), cobrindo: cadastro, comunicado, roteiro geral e por
  prova, quiz, links, `.docx` com hyperlink, chave inválida, troca de modelo.
- Publicar no GitHub Pages e validar no celular.

**Fase 1b: adaptar para tablet e desktop.** Decisão de 20/09/2026. Manter
mobile-first, mas em telas largas usar layout de duas colunas, navegação lateral
no lugar da barra inferior e mais respiro. Trabalho de CSS, sem mexer na lógica.

**Fase 2: servidor com chave protegida e turmas.**

- Cloudflare Worker (conta separada da empresa) com duas funções: (a) porteiro do
  Gemini, guardando a chave como secret; (b) turmas compartilhadas em KV ou D1.
- Turma = escola + ano + sala, com código de acesso. Compartilhado: provas,
  datas, assuntos, links, conteúdo condensado, resumo de vídeo, roteiro base e um
  banco de perguntas por matéria. Privado no aparelho: tudo da criança.
- Qualquer mãe da turma pode corrigir um dado, com registro de quem alterou por
  último, e cada família pode ajustar só para si. O app avisa quando houver
  material novo.
- Proteções: código de acesso, limite de pedidos por aparelho, checagem de
  origem, teto diário.
- O app precisa funcionar nos dois modos: chave própria (Simone) e via servidor
  (as mães).
- Antes de abrir para outras famílias: ativar o nível pago do Gemini (para o
  conteúdo não ser usado em treino), tela curta de aviso de privacidade e termos.
  Envolve dados de crianças, então trate LGPD como requisito, não como detalhe.

**Fase 3: acabamento e vitrine.**

- PWA (manifest, ícone, instalar na tela inicial, funcionar offline para o que já
  foi carregado).
- `index.html` na raiz listando os apps. Todos compartilham a mesma origem, então
  cada um usa prefixo próprio no `localStorage`.
- Avaliar organização do GitHub ou domínio próprio para o link não levar o
  usuário pessoal. Decidir **antes** de divulgar, porque trocar depois quebra os
  links.
- Próximo app da fila: rotina infantil com sistema de recompensa. Não comece sem
  a Simone pedir.

## 7. Regras de trabalho

- Antes de qualquer ação destrutiva ou irreversível (apagar arquivos,
  `push --force`, reescrever histórico, mudar configurações de conta), pare e
  pergunte.
- Nunca grave chaves, tokens ou senhas em arquivo versionado, log ou mensagem.
  Configure `.gitignore` e secrets do Worker pela linha de comando, com a Simone
  digitando os valores.
- Commits pequenos, mensagens em português, um assunto por commit. Mostre o diff
  resumido antes de dar push.
- Não reescreva o app do zero nem troque de stack sem apresentar o motivo e
  receber aprovação.
- Texto de interface: português simples, frases curtas, tom acolhedor para
  criança de 9 a 10 anos e para mãe leiga. Erros dizem o que aconteceu e o que
  fazer.
- Tudo o que a IA devolve passa por validação antes de entrar no estado (datas,
  ids, índices do quiz). Mantenha isso.
- Quando algo não puder ser testado, diga claramente o que ficou sem teste.
- Blocos de foco de até 1h30. No começo de cada sessão, diga em poucas linhas
  onde paramos e proponha o próximo passo.
