# Semana de Prova: documento de produto

Este documento descreve o que o app é, para quem serve e como funciona do ponto de vista de quem usa. A parte técnica está no `PROMPT-CLAUDE-CODE.md` e no `CLAUDE.md`. Em caso de dúvida sobre uma mudança, este documento decide a intenção.

Legenda: **[hoje]** já existe no app. **[planejado]** está decidido, mas ainda não foi construído.

## 1. Para que serve

Semana de prova costuma ser caótica: o comunicado chega por um canal, as páginas para estudar estão em três livros, uma professora manda vídeo, outra manda Word, e a criança não sabe por onde começar. A mãe vira gerente de estudos sem ter tempo para isso.

O Semana de Prova pega todo esse material e transforma em um plano simples: o que estudar hoje, em quanto tempo, com explicação quando a criança trava e perguntas no fim para fixar. A mãe organiza uma vez; a criança segue sozinha no dia a dia; a mãe acompanha sem precisar ficar em cima.

## 2. Para quem

- **A criança**, do 1º ao 9º ano, com foco em 8 a 11 anos. Usa o app todo dia na semana de prova, no celular ou tablet, de preferência sozinha.
- **A mãe ou responsável**, quase sempre leiga em tecnologia e com pouco tempo. Monta a semana, confere datas e acompanha o progresso.
- **A turma** [planejado]: mães da mesma sala compartilham o material já processado, para que só uma precise cadastrar.

## 3. Princípios

1. **A mãe leiga consegue usar.** Abrir o link e tirar foto. Sem conta, sem chave, sem configuração [planejado para as outras mães; hoje eu uso com chave própria].
2. **A criança consegue usar sozinha, sem poder quebrar nada.** Uma tela por vez, botões grandes, frases curtas, tom animado e sem bronca. A área dela não tem nenhum botão que apague.
3. **O material da escola manda.** Explicações e perguntas saem do que a professora indicou, não de conhecimento geral. Na dúvida, vale o livro e a professora.
4. **Sessões curtas.** De 15 a 30 minutos, dentro de um limite diário que a família define.
5. **Errar faz parte.** O erro não é punido; ele vira reforço na revisão.
6. **Os dados da criança são da família.** Nome, progresso e notas ficam só no aparelho.
7. **A mãe sempre confere.** A IA erra, principalmente datas. Nada vira roteiro sem a mãe poder corrigir.

## 4. Jornada da mãe

### 4.1 Primeira vez

Ao abrir o link, o app oferece duas saídas, e não pede nada antes disso: **[hoje]**

1. **Primeira vez aqui** — cadastra quem vai estudar: apelido, ano escolar e ritmo. Pode cadastrar mais de uma criança; cada uma tem suas provas, seu roteiro e seu progresso.
2. **Já tenho um código** — cola um código recebido. É um campo só, e o app reconhece sozinho o que chegou: se for a cópia de outro aparelho seu, restaura tudo; se for o código da turma, pede só o nome da criança e traz as provas, o material e o roteiro da sala.

Depois, quem quiser ligar a IA cola a chave do Gemini na aba Pais **[hoje, só no meu uso]**, e opcionalmente a do Groq, que deixa roteiro, explicação e quiz mais rápidos. Para as outras mães esse passo não existirá: elas digitam o código da turma e pronto **[planejado]**.

Os códigos são comprimidos pelo próprio navegador, o que os deixa cerca de dez vezes menores e faz caberem numa mensagem. Códigos antigos, em texto puro, continuam sendo aceitos. **[hoje]**

### 4.2 Montando a semana
1. Na aba Provas, toca em "Ler o comunicado" e junta tudo o que recebeu: foto, print, PDF, Word (.docx) ou texto colado de mensagem. Pode juntar arquivos de várias professoras e ler de uma vez. **[hoje]**
2. O app extrai cada prova: matéria, data, o que cai, páginas indicadas e links que a professora mandou (inclusive links escondidos em "clique aqui"). **[hoje]**
3. A mãe confere, principalmente as datas, e corrige em "Editar" se precisar. Também pode adicionar uma prova na mão. **[hoje]**
4. Em cada prova, envia o material de estudo: fotos das páginas, PDF, Word ou texto colado. O app lê e guarda um resumo condensado do conteúdo, não a foto. **[hoje]**
4b. **A câmera é do próprio app e fica aberta.** Cada toque no disparador guarda mais uma página, sem sair para a galeria e sem voltar para a tela a cada foto: dá para fotografar a apostila inteira de uma vez, virando página e tocando. As miniaturas aparecem embaixo numeradas, e uma foto ruim pode ser apagada ali mesmo. No fim, "Pronto" fecha a câmera e a fila inteira é lida numa única chamada de IA. Se o navegador não liberar a câmera, o app cai na câmera do sistema, uma foto por vez. **[hoje]**
4a. Ao ler as páginas, o app também identifica de que material elas vieram (sistema ou editora, volume, edição) e separa o conteúdo em blocos por assunto, guardando a página apenas como referência de onde aquilo está. A mãe vê o material identificado no cartão da prova e pode corrigi-lo em "Editar". Isso é o que vai permitir, na fase de turmas, reaproveitar o conteúdo já lido por outra mãe sem processar tudo de novo. **[hoje]**
4c. **O que fica guardado é texto, não foto.** Cada prova mostra quanto tem em unidade conferível — *"4 trechos · p. 4 a 6"* — e o detalhe trecho a trecho fica em "O que a IA entendeu". Reenviar as mesmas fotos não duplica nada nem infla o número: blocos idênticos são descartados pelo hash do texto. **[hoje]**
4d. A tela de Provas abre com um resumo do que falta: *"2 de 3 provas ainda sem material: Espanhol, Ciências"*. Se uma matéria do comunicado nem virou prova, a IA não a encontrou — a saída é ler o comunicado de novo (a leitura junta, não duplica) ou cadastrar na mão. **[hoje]**
5. Se a professora indicou vídeo do YouTube, toca em "Ler este vídeo para o quiz". A IA assiste e o resumo do vídeo entra no material da prova. Só funciona com vídeo público. **[hoje, sem teste real ainda]**
6. Monta o roteiro: de todas as provas de uma vez, ou de uma prova só ("Montar roteiro desta prova"), indo aos poucos. Cada cartão mostra se a prova está "no roteiro" ou "fora do roteiro". **[hoje]**

### 4.3 Durante a semana
- Chegou material novo: envia na prova correspondente. O conteúdo se soma ao anterior e já vale para explicações e quizzes. Se mudar muito, refaz o roteiro daquela prova; o que a criança já concluiu continua marcado. **[hoje]**
- Chegou comunicado novo: lê de novo. Prova repetida (mesma matéria **e** data) não duplica; links novos são somados. Mudança de data se corrige em "Editar". **[hoje]**
- Quando dois comunicados falam da mesma prova com **datas diferentes**, o app não junta sozinho, porque duas provas da mesma matéria em datas diferentes podem ser reais. Ele avisa que a matéria aparece mais de uma vez e oferece juntar: a mãe escolhe a data certa e as outras entradas somem, levando para a escolhida os assuntos, as páginas, os links e o material lido que cada uma trouxe. **[hoje]**
- Na aba Pais, acompanha por matéria: sessões feitas, percentual de acertos no quiz e "pontos de atenção", que são os assuntos em que a criança errou. **[hoje]**
- Ajusta o **ritmo de cada filho** (calmo, normal ou puxado), que define quanto conteúdo entra em cada parte. É o ajuste certo quando a criança precisa de mais tempo para absorver. **[hoje]**
- Ajusta o tempo máximo de estudo por dia (30, 45, 60 ou 90 minutos) e se estuda no fim de semana. **[hoje]**
- No **diário técnico** vê o que a IA fez: qual IA, qual modelo, quanto demorou e o erro exato quando algo falha. **[hoje]**
- Faz cópia de segurança por código, para levar os dados a outro aparelho. A chave da IA nunca entra nessa cópia. **[hoje]**
- Ao fim da semana, usa "Nova semana de provas" para limpar e recomeçar. **[hoje]**

### 4.4 Com a turma

O compartilhamento tem duas camadas, com chaves diferentes, porque são coisas de natureza diferente:

- **As provas são da turma.** Quais matérias, que dia, o que cai: isso muda de unidade para unidade. O nome da escola é só rótulo, nunca a chave — por isso "Colégio Objetivo", que existe em centenas de unidades, não gera confusão.
- **O material não é da escola.** A apostila do 5º ano do Objetivo é a mesma em todas as unidades do Brasil. O conteúdo lido é guardado por matéria e assunto, com a identificação do material (sistema, volume, edição) e a página como referência de onde encontrar. A edição entra na identificação porque páginas mudam de lugar entre edições, e cada bloco guarda uma impressão digital do texto, que serve para reconhecer conteúdo repetido.

### Hoje: código da turma, sem servidor **[hoje]**

Em Pais, "Compartilhar com a turma" copia um código com o que é da turma: provas, datas, assuntos, páginas, links, o material que a IA já leu e o roteiro pronto. A mãe manda no grupo da sala; as outras colam no app delas.

- **Nunca vai nada da criança**: nem nome, nem progresso, nem notas, nem os erros dos quizzes.
- **Soma, não substitui**: prova que a mãe já tem não duplica, e o roteiro só entra em prova que ainda não tem um. O que o filho dela já fez não é tocado.
- **Quem recebe não precisa de chave de IA** para usar o roteiro: ele chega pronto e a criança já consegue estudar e marcar as partes. A chave só faz falta para explicação, quiz e para ler material novo.

Essa é a versão de hoje do compartilhamento: resolve a turma agora, sem servidor, com o mesmo formato de dados que a Fase 2 vai usar.

### O servidor (porteiro das IAs) **[hoje, a ligar]**

O Worker na Cloudflare guarda as chaves como secret. O app manda o pedido para ele, que acrescenta a chave e chama a IA. **Nenhum aparelho precisa de chave** — nem o da mãe que montou, nem o das outras.

- O Worker faz a mesma divisão que o app faz: texto puro (roteiro, explicação, quiz) vai no Groq, que é bem mais rápido; foto, PDF em imagem e vídeo vão no Gemini. Se o Groq falhar, ficar sem modelo ou devolver resposta cortada, o Gemini assume sem que o app perceba. A chave do Groq é opcional: sem ela, tudo vai no Gemini como antes.
- O diário técnico do app mostra qual das duas atendeu cada pedido, para dar para auditar quando algo demorar.

- Ligado em Pais → Inteligência artificial → Servidor: endereço e código de acesso, uma vez por aparelho.
- O app funciona nos dois modos. Se o servidor cair por motivo técnico, ele usa a chave própria como reserva, quando houver uma. Erro que é decisão do servidor (código inválido, cota do dia) não tenta de novo pela chave.
- Protege com teto diário por aparelho, limite de tamanho do pedido, código de acesso e checagem de origem. O código é obstáculo, não segurança: quem abre o app consegue lê-lo. O que segura de verdade é o teto diário, e o código serve para revogar.
- Antes de abrir para outras famílias: nível pago do Gemini, aviso de privacidade e termos.

### Depois: turma no servidor [planejado]

- A primeira mãe cria a turma (escola, ano e sala) e recebe um código para mandar no grupo da sala.
- Tudo o que ela cadastrar e a IA processar fica disponível para a turma: provas, datas, assuntos, links, conteúdo condensado, resumo dos vídeos, roteiro base e um banco de perguntas por matéria.
- As outras mães abrem o link, digitam o código e o app já vem preenchido. Não precisam fotografar nada.
- Qualquer mãe da turma pode corrigir um dado errado; fica registrado quem alterou por último. Cada família também pode ajustar só para si.
- Quando alguém envia material novo, o app avisa as demais.
- Nunca é compartilhado: nome da criança, progresso, notas e erros.

## 4.5 Separação entre a criança e a mãe

O app tem duas áreas, e a divisão é por quem faz o quê, não por conteúdo.

- **Estudar** é da criança: as partes, os passos, a explicação e o quiz. Nunca tranca, nunca pede senha, não tem nenhum botão que apague coisa alguma. **[hoje]**
- **Pais** é da mãe, protegida por uma senha de 4 números: cadastrar e editar provas, enviar material, montar roteiro, "O que a IA entendeu", chaves das IAs, ritmo de cada filho, cópia de segurança e diário técnico. **[hoje]**

A senha não é segurança de verdade — é um obstáculo para a criança não apagar sem querer. Fica só no aparelho, fora da cópia de segurança, como as chaves. Se a mãe esquecer, "Esqueci a senha" pede uma multiplicação de dois números de dois dígitos: ela resolve na calculadora, a criança dificilmente se dá ao trabalho. Nenhum dado se perde nesse caminho. **[hoje]**

Antes de qualquer ação que apague de verdade — nova semana, remover criança, restaurar cópia —, o app diz **exatamente o que será perdido** (quantas provas, quantas partes, quantos quizzes com o histórico de erros) e oferece salvar uma cópia primeiro. **[hoje]**

- A senha volta a valer **assim que a mãe sai da aba Pais**, sem precisar recarregar: no tablet, que fica aberto o dia inteiro, era por aí que a criança entrava. **[hoje]**
- A senha viaja no código de “para outro aparelho meu”, então o tablet da criança chega já trancado. Código sem senha (versão antiga, ou mãe que não usa) continua funcionando. Ela não é segurança, e sim a tranca que impede a criança de apagar prova e roteiro sem querer. **[hoje]**
## 4.6 Vários aparelhos

Cada aparelho é uma ilha: o que a criança faz no tablet dela não aparece no celular da mãe. Não há sincronização até o servidor da Fase 2. **[hoje]**

Cada aparelho diz para quem ele é, em Pais: **meu** (acesso completo, dá para trocar de filho e cadastrar outros) ou **de um filho específico** (abre direto no perfil dele, sem o botão que troca de perfil, e o outro filho nem aparece). Esse ajuste fica só no aparelho, fora da cópia de segurança. **[hoje]**

Para levar os dados de um aparelho a outro, Pais traz um botão que copia o código com um toque, para mandar por mensagem para si mesma e colar no outro aparelho. Quando o material lido deixa o código grande demais para uma mensagem, há uma **cópia leve** que mantém provas, datas, páginas e roteiro e descarta só o material lido, que pode ser reenviado depois. **[hoje]**

A chave da IA nunca vai na cópia de segurança. Para usá-la em outro aparelho, Pais permite **mostrar e copiar a chave** — atrás da senha dos pais. **[hoje]**

Todos os aparelhos gastam da mesma cota gratuita, porque a cota é do projeto na Google, não do aparelho. Os dados ficam presos ao endereço do site: se o app mudar de endereço, é preciso exportar a cópia antes e restaurar no endereço novo. **[hoje]**

## 5. Jornada da criança

O app **oferece**, não manda. Todo o estudo de cada prova aparece de uma vez, em partes numeradas na ordem sugerida, e a criança escolhe qual fazer agora. Não há sessão presa a um dia: se ela quiser fazer três partes num sábado e nenhuma na segunda, tudo bem. A única exceção é a revisão da véspera, que continua ligada à data da prova, porque é ela que traz de volta o que a criança errou nos quizzes. **[hoje]**

1. Abre o app e cai na tela **Estudar**. No alto, uma régua com os próximos dias, com bandeira vermelha nos dias de prova. **[hoje]**
2. Se a prova é amanhã, a revisão de véspera aparece destacada no topo, antes de tudo. **[hoje]**
3. Abaixo, uma seção por prova, da mais próxima para a mais distante: nome da matéria, quantos dias faltam, barra de progresso ("3 de 7 partes feitas") e a lista completa das partes. **[hoje]**
4. Toca na parte que quiser. Se houver link da professora, ele aparece primeiro, como botão grande ("A professora pediu para assistir"). **[hoje]**
5. Segue "O que fazer": passos concretos, citando páginas e assuntos reais, e vai marcando cada um. A quantidade de passos e o tamanho de cada parte seguem o ritmo definido para aquela criança. **[hoje]**
6. Se não entendeu, toca em "Explica pra mim": recebe uma explicação curta, com exemplos do dia a dia e uma dica para lembrar na prova. Pode pedir "de outro jeito". **[hoje]**
7. Faz o quiz: 5 perguntas na parte normal, 8 na revisão. Uma pergunta por vez, quatro opções, resposta na hora com uma explicação de por que é aquela. **[hoje]**
8. Vê o resultado com uma mensagem de incentivo. Se errou, o app mostra o que vale reler e avisa que aquilo volta na revisão. Pode treinar de novo com perguntas novas. **[hoje]**
9. A parte fica marcada como feita e o progresso da matéria sobe. Também dá para marcar como feita sem quiz. **[hoje]**
10. No dia da prova, em vez das partes aparece um recado de boa sorte. **[hoje]**

## 6. Regras do roteiro

- Cada prova vira de 2 a 8 partes numeradas, em ordem de estudo, do mais básico ao mais avançado. As partes cobrem todo o material guardado, sem repetir conteúdo entre elas.
- **As partes não têm dia marcado.** A criança escolhe quando fazer cada uma. A única com data é a revisão, sempre a última, colocada na véspera da prova.
- **Ritmo** (por criança: calmo, normal ou puxado) define quanto conteúdo cabe em cada parte e quantos passos ela tem. Ritmo calmo faz mais partes menores, com repetição; ritmo puxado faz menos partes maiores. É a régua certa para criança que precisa de mais tempo — aumentar o tempo máximo por dia não resolve isso.
- **Tempo máximo de estudo por dia** é outra coisa: é só uma referência de quanto a família tem disponível, usada para avisar quando o conteúdo não cabe no tempo que sobra até a prova.
- Quando há mais conteúdo do que tempo, o app **avisa antes de montar** e deixa a mãe escolher: priorizar o mais importante, acelerar o ritmo só naquela prova, ou montar assim mesmo. Ele nunca espreme em silêncio.
- Se a prova tem link indicado pela professora, a primeira parte inclui um passo para assistir ou acessar.
- Refazer o roteiro nunca apaga o que a criança já concluiu.
- Se a IA falhar ou estiver desligada, o app monta um roteiro simples por conta própria, respeitando o mesmo ritmo.
- O roteiro só fala do material que foi realmente enviado. Quando o comunicado pede páginas que não entraram no app, a prova avisa **dizendo quais páginas faltam**, não só quantas. Uma foto pode trazer duas páginas (livro aberto): a IA é instruída a tratar cada página separadamente, e a contagem é por número de página, nunca por número de fotos.

## 7. Regras do quiz e da explicação

- A fonte principal é o material enviado para aquela prova. Sem material, as perguntas saem só dos assuntos do comunicado, e o app avisa que podem não bater com o livro.
- Quatro opções, uma correta, erradas plausíveis, sem pegadinha. Mistura de perguntas de lembrar com perguntas de aplicar numa situação.
- A ordem das opções é embaralhada pelo app.
- O app não repete perguntas já feitas naquela matéria.
- O que a criança erra fica registrado por assunto e volta como reforço nos próximos quizzes, principalmente na revisão.
- A explicação tem no máximo cerca de 180 palavras, em linguagem da idade, sem inventar fatos fora do material.

## 8. Telas

- **Boas-vindas**: cadastro da criança.
- **Estudar**: régua dos próximos dias, revisão de véspera em destaque, e uma seção por prova com progresso e a lista completa das partes.
- **O que a IA entendeu**: por prova, o que veio do comunicado, o material lido bloco a bloco e o roteiro montado. Serve para a mãe auditar e corrigir.
- **Sessão**: links da professora, passos, explicação, quiz.
- **Quiz** e **Resultado**.
- **Provas**: comunicados, cartão de cada prova (data, assuntos, páginas, links, situação do material e do roteiro), envio de material, roteiro por prova e geral.
- **Comunicados**: câmera, fila de arquivos e campo para colar texto.
- **Câmera**: tela cheia, sobre o app. Contador de fotos, miniaturas numeradas com apagar, disparador grande, "Pronto" e "Cancelar". Trava sozinha quando a fila enche.
- **Material da prova**: colar texto.
- **Editar prova**: matéria, data, o que cai, páginas e links.
- **Pais** (com senha): provas e material, progresso por matéria, as duas IAs, ajustes do roteiro, ritmo de cada filho, crianças, cópia de segurança, diário técnico e nova semana.

## 9. O que a IA faz e o que não faz

Faz: lê comunicados e páginas (foto, PDF, Word, texto), assiste a vídeo público do YouTube, extrai provas e links, condensa o conteúdo, identifica de que material as páginas vieram, monta o roteiro, explica e cria perguntas.

São duas IAs, com divisão clara: tudo que exige **enxergar** (foto, PDF, vídeo) vai para o Gemini, que é o único gratuito capaz de ler vídeo do YouTube direto do endereço. Roteiro, explicação e quiz trabalham só em cima do texto já extraído e vão para uma segunda IA mais rápida (Groq), seja pela chave do aparelho, seja pelo servidor. Se a segunda IA falhar ou não estiver ligada, tudo volta para o Gemini sozinho.

Não faz: não substitui a professora nem o livro; pode errar, principalmente em datas, em links lidos de foto e em fotos ruins; não lê vídeo privado ou não listado; não lê o formato antigo `.doc`. Por isso o app sempre deixa a mãe conferir e corrigir, e avisa na aba Pais que o conteúdo é gerado por IA.

## 10. Privacidade e cuidados

- Nome, progresso, notas e erros da criança ficam só no aparelho. O nome nunca é enviado à IA; só o ano escolar.
- Fotos não são guardadas; fica apenas o texto condensado. A câmera do app só fica ligada enquanto a tela dela está aberta, nada é gravado, e ao fechar o aparelho desliga a câmera de verdade. As fotos da fila vivem só na memória até serem lidas.
- Em navegador, a câmera dentro do app só funciona em endereço seguro (https). No link do GitHub Pages funciona; abrindo o arquivo direto do computador, não — e aí o app usa a câmera do sistema.
- O app orienta a cortar da foto o nome completo da criança.
- O conteúdo guardado é resumo de estudo, não reprodução de páginas de livro.
- As chaves de IA ficam só no aparelho e fora da cópia de segurança. Com o servidor ligado, elas nem existem no aparelho: ficam como secret na Cloudflare.
- Antes de abrir para outras famílias [planejado]: nível pago da IA (para o conteúdo não ser usado em treinamento), aviso curto de privacidade, termos, código de acesso por turma e limite de uso por aparelho. Envolve dados de crianças, então LGPD é requisito.

## 11. Fora do escopo por enquanto

Notas oficiais da escola, comunicação com professoras, conteúdo próprio (o app não ensina matéria que não veio do material), ranking entre crianças, login com conta, notificações. O próximo app da linha, de rotina infantil com recompensas, é um projeto separado.

## 12. Como saber se deu certo

- A criança abre o app e estuda sem a mãe precisar mandar mais de uma vez.
- A mãe monta a semana em menos de 15 minutos.
- As perguntas do quiz se parecem com o que caiu na prova.
- Uma mãe leiga da turma consegue usar só com o link e o código.
