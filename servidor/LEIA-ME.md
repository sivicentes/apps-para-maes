# Servidor (porteiro das IAs)

Guarda as chaves e responde ao aplicativo. Com ele ligado, **nenhum aparelho
precisa de chave** — nem o meu, nem o das outras mães.

```
                         ┌─ texto (roteiro, explicação, quiz) ─> Groq
app ──> Worker ──chaves──┤
                         └─ foto, PDF, vídeo ───────────────> Gemini
```
O Groq é bem mais rápido, mas não enxerga imagem. O Worker escolhe sozinho:
pedido com foto ou vídeo vai direto no Gemini. Se o Groq falhar por qualquer
motivo, o Gemini assume sem que o app perceba — e se você não configurar a
chave do Groq, tudo funciona como antes, só no Gemini.

## Antes de começar

O `PROMPT-CLAUDE-CODE.md` pede **conta da Cloudflare separada da empresa**.
Se a sua única conta hoje é a da empresa, crie uma pessoal primeiro:

1. Abra `dash.cloudflare.com/sign-up`
2. Use um e-mail pessoal, não o da empresa
3. Confirme o e-mail. É gratuito e não pede cartão.

Isso importa: o Worker vai ficar amarrado à conta onde for publicado, e um dia
você pode querer levá-lo para um domínio próprio sem depender da empresa.

## Publicar (uma vez só)

**De onde rodar:** sempre da raiz do projeto (`apps-para-maes/`), com os atalhos
`npm run ...` abaixo. Eles já apontam para a configuração certa, então não
precisa entrar na pasta `servidor/`.

**Passo zero, uma vez na vida:**

```bash
npm install
```

Baixa o `wrangler` (o programa da Cloudflare) para dentro do projeto. Sem ele os
atalhos respondem *"wrangler não é reconhecido como um comando interno ou
externo"*. Nada disso vai para o GitHub: a pasta `node_modules` fica só no seu
computador.

Para conferir que está tudo no lugar — sem publicar, sem gastar nada e sem
precisar estar logada:

```bash
npm run servidor:conferir
```

Ele deve listar `env.ORIGENS` e `env.TETO_DIA` e terminar com
*"--dry-run: exiting now"*. Se isso aparecer, os outros comandos vão funcionar.

```bash
npm run servidor:login
```
Abre o navegador. Entre na **conta pessoal**.

```bash
npm run servidor:chave
```
Cola a chave do **Gemini** quando ele pedir. Ela vai direto para a Cloudflare —
não passa por arquivo, nem por log, nem por mim. Esta é a obrigatória: sem ela
o app não lê foto, PDF nem vídeo.

```bash
npm run servidor:groq
```
A chave do **Groq** (começa com `gsk_`), pega em console.groq.com.
**Opcional, mas vale a pena:** com ela, o roteiro, a explicação e o quiz ficam
bem mais rápidos, e as mães da turma ganham isso sem colar chave nenhuma.
Para conferir depois se as duas estão lá: `npx wrangler secret list --config
servidor/wrangler.toml` — ele mostra os nomes, nunca os valores.

```bash
npm run servidor:codigos
```

**Este valor você inventa.** Não vem da Cloudflare nem do Google: é a senha da
porta do seu servidor. Quem tiver ela (e o endereço) usa a IA por sua conta.

Escreva os códigos **separados por vírgula, sem espaço**. A sugestão:

```
CASA2026,TURMA4A
```

- `CASA2026` — para os seus aparelhos: seu celular, seu computador, os tablets.
- `TURMA4A` — o que você vai passar para as mães da turma.

Serve qualquer palavra, contanto que não seja óbvia. Separar assim é o que
permite cortar o acesso de um grupo sem atrapalhar o outro.

### O que aparece na tela

O terminal pergunta:

```
✔ Enter a secret value: …
```

Digite ali e aperte Enter. **O que você digita não aparece** — sai em branco ou
como bolinhas, igual a campo de senha. É assim mesmo, não é travamento.

### Para mudar depois

Rodar o comando de novo **substitui a lista inteira**, não acrescenta. Então
para incluir uma turma nova, digite tudo de uma vez:

```
CASA2026,TURMA4A,TURMA5B
```

E para tirar o acesso de um grupo, digite a lista sem ele. Vale depois rodar
`npm run servidor:publicar`. Quem usava o código removido volta a ver "o código
de acesso não foi aceito" — e ninguém perde dado nenhum, porque o roteiro e o
progresso estão no aparelho, não no servidor.

```bash
npm run servidor:kv
```
Cria o contador do teto diário. Ele devolve um `id` — cole no `wrangler.toml`,
na seção `[[kv_namespaces]]`, e tire o `#` das três linhas.
**Opcional:** sem isso o Worker funciona, mas sem teto diário.

```bash
npm run servidor:publicar
```
No fim ele imprime o endereço, algo como
`https://semana-de-prova.SEU-NOME.workers.dev`

**Abrir esse endereço no navegador não mostra o aplicativo.** Ele não é um site:
é o porteiro, e só conversa com o app. Quem abrir vê uma página dizendo que o
servidor está no ar, com um botão para o aplicativo de verdade. Para onde esse
botão leva é o `APP` do `wrangler.toml`.

Se aparecer `{"erro":"metodo"}` em vez da página, o servidor está funcionando
mas numa versão antiga: rode `npm run servidor:publicar` de novo.

## Ligar no aplicativo

No app: **Pais → Inteligência artificial → Servidor**.
Cole o endereço e **um** dos códigos, e toque em *Ligar e testar*.

| aparelho | código |
|---|---|
| seu celular, seu computador, os tablets | `CASA2026` |
| o das mães da turma | `TURMA4A` |

Cada aparelho guarda isso uma vez e não pergunta mais. O código não viaja no
código de transferência nem no da turma: em aparelho novo, é colar de novo.

A partir daí aquele aparelho não precisa mais de chave nenhuma. A chave que já
estiver guardada nele continua servindo de reserva, caso o servidor caia.

Para outra mãe é o mesmo: ela recebe o endereço e o código da turma, e pronto.
Mande os dois pela mesma mensagem — sozinhos, nenhum dos dois serve para nada.

## Ajustes

No `wrangler.toml`:

- `ORIGENS` — endereços que podem chamar o Worker. Acrescente o domínio próprio
  quando comprar. Vazio libera qualquer origem.
- `APP` — para onde vai o botão de quem abrir o endereço do servidor no
  navegador. Troque junto com o domínio próprio.
- `TETO_DIA` — pedidos por aparelho por dia (padrão 120). Depois de mudar,
  rode `npm run servidor:publicar` de novo.

## Testar sem gastar cota

```bash
npm test
```
90 verificações com as duas IAs simuladas: nenhuma chamada real, nenhuma chave.

Para ver o que está acontecendo no servidor de verdade:

```bash
npm run servidor:log
```

## O que protege, e o que não protege

| | |
|---|---|
| **teto diário por aparelho** | é o que realmente segura a conta |
| **limite de tamanho** | evita pedido caro demais |
| **código de acesso** | obstáculo, **não** segurança: quem abre o app consegue lê-lo. Serve para você revogar |
| **checagem de origem** | barra uso por outro site no navegador, mas não barra quem chama por fora |

Ou seja: trate o código como uma chave de porta, não como um cofre. Se um dia
vazar, troque o código e publique de novo — leva um minuto, e ninguém perde
dado nenhum.

## Antes de abrir para outras famílias

Continua valendo o que está no `PRODUTO.md`:

- ativar o nível pago do Gemini, para o conteúdo não ser usado em treinamento
- tela curta de aviso de privacidade e termos
- são dados de crianças, então LGPD é requisito, não detalhe
