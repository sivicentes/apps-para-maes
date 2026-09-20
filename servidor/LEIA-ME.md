# Servidor (porteiro do Gemini)

Guarda a chave do Gemini e responde ao aplicativo. Com ele ligado, **nenhum
aparelho precisa de chave** — nem o meu, nem o das outras mães.

```
app ──> Worker ──chave──> Gemini
        (a chave só existe aqui)
```

## Antes de começar

O `PROMPT-CLAUDE-CODE.md` pede **conta da Cloudflare separada da empresa**.
Se a sua única conta hoje é a da empresa, crie uma pessoal primeiro:

1. Abra `dash.cloudflare.com/sign-up`
2. Use um e-mail pessoal, não o da empresa
3. Confirme o e-mail. É gratuito e não pede cartão.

Isso importa: o Worker vai ficar amarrado à conta onde for publicado, e um dia
você pode querer levá-lo para um domínio próprio sem depender da empresa.

## Publicar (uma vez só)

Rode tudo dentro desta pasta (`servidor/`).

```bash
npx wrangler login
```
Abre o navegador. Entre na **conta pessoal**.

```bash
npx wrangler secret put GEMINI_KEY
```
Cola a chave do Gemini quando ele pedir. Ela vai direto para a Cloudflare —
não passa por arquivo, nem por log, nem por mim.

```bash
npx wrangler secret put CODIGOS
```
Os códigos de acesso, separados por vírgula. Ex.: `CASA2026,TURMA4A`
Um por turma facilita revogar depois: basta rodar este comando de novo sem ele.

```bash
npx wrangler kv namespace create USO
```
Cria o contador do teto diário. Ele devolve um `id` — cole no `wrangler.toml`,
na seção `[[kv_namespaces]]`, e tire o `#` das três linhas.
**Opcional:** sem isso o Worker funciona, mas sem teto diário.

```bash
npx wrangler deploy
```
No fim ele imprime o endereço, algo como
`https://semana-de-prova.SEU-NOME.workers.dev`

## Ligar no aplicativo

No app: **Pais → Inteligência artificial → Servidor**.
Cole o endereço e um dos códigos, e toque em *Ligar e testar*.

A partir daí aquele aparelho não precisa mais de chave. A chave que já estiver
guardada nele continua servindo de reserva, caso o servidor caia.

Para outra mãe é o mesmo: ela recebe o endereço e o código, e pronto.

## Ajustes

No `wrangler.toml`:

- `ORIGENS` — endereços que podem chamar o Worker. Acrescente o domínio próprio
  quando comprar. Vazio libera qualquer origem.
- `TETO_DIA` — pedidos por aparelho por dia (padrão 120). Depois de mudar,
  rode `npx wrangler deploy` de novo.

## Testar sem gastar cota

```bash
npm test
```
39 verificações com um Gemini simulado: nenhuma chamada real, nenhuma chave.

Para ver o que está acontecendo no servidor de verdade:

```bash
npx wrangler tail
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
