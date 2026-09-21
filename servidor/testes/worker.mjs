/* Testes do porteiro. Roda o Worker com um Gemini falso: nenhuma chamada
   real, nenhuma chave. Uso: node servidor/testes/worker.mjs                */
import worker from "../src/worker.js";

let passou = 0, falhou = 0;
const ok = (c, m) => { if (c) { passou++; console.log("  ok   " + m); } else { falhou++; console.log("  FALHA " + m); } };
const eq = (a, b, m) => ok(a === b, m + (a === b ? "" : `  (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`));

const ORIGEM = "https://sivicentes.github.io";
const real = globalThis.fetch;
let chamadas = [];
function geminiFalso(resposta) {
  chamadas = [];
  globalThis.fetch = async (url, opts) => {
    chamadas.push({ url: String(url), headers: opts.headers, body: JSON.parse(opts.body) });
    return typeof resposta === "function" ? resposta(String(url)) : resposta;
  };
}
const jsonOk = obj => ({ ok: true, status: 200, json: async () => obj });
const jsonErro = (status, msg) => ({ ok: false, status, json: async () => ({ error: { message: msg || "erro" } }) });
const RESP = t => jsonOk({ candidates: [{ content: { parts: [{ text: t }] }, finishReason: "STOP" }] });

function kvFalso() {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, _m: m };
}
const ENV = extra => ({ GEMINI_KEY: "CHAVE-SECRETA-DO-SERVIDOR", CODIGOS: "TURMA4A,TURMA5B", ORIGENS: ORIGEM, TETO_DIA: "3", ...extra });
const pedido = (body, origem = ORIGEM, metodo = "POST") =>
  new Request("https://w.example/", { method: metodo, headers: { "Content-Type": "application/json", Origin: origem }, body: metodo === "POST" ? JSON.stringify(body) : undefined });
const CORPO = { codigo: "TURMA4A", aparelho: "ap1", prompt: "Explique a cadeia alimentar" };

console.log("\n1. deixa passar o pedido certo");
{
  geminiFalso(RESP("A cadeia alimentar mostra quem come quem."));
  const r = await worker.fetch(pedido(CORPO), ENV());
  const d = await r.json();
  eq(r.status, 200, "responde 200");
  eq(d.texto, "A cadeia alimentar mostra quem come quem.", "devolve o texto da IA");
  eq(chamadas.length, 1, "chamou o Gemini uma vez");
  eq(chamadas[0].headers["x-goog-api-key"], "CHAVE-SECRETA-DO-SERVIDOR", "usou a chave do servidor");
  ok(chamadas[0].url.includes("gemini-3.8-flash"), "começou pelo modelo mais novo");
  eq(chamadas[0].body.contents[0].parts.at(-1).text, CORPO.prompt, "encaminhou o texto");
  eq(chamadas[0].body.generationConfig.thinkingConfig.thinkingLevel, "minimal", "manteve o thinking mínimo");
  ok(chamadas[0].body.generationConfig.maxOutputTokens > 0, "e o limite de saída");
  eq(r.headers.get("Access-Control-Allow-Origin"), ORIGEM, "libera a origem do app");
}

console.log("\n2. a chave nunca sai do servidor");
{
  geminiFalso(RESP("ok"));
  const r = await worker.fetch(pedido(CORPO), ENV());
  const txt = await r.text();
  ok(!txt.includes("CHAVE-SECRETA"), "a chave não aparece na resposta");
  ok(!txt.includes("x-goog-api-key"), "nem o nome do cabeçalho");
}

console.log("\n3. barra quem não deve passar");
{
  geminiFalso(RESP("ok"));
  let r = await worker.fetch(pedido({ ...CORPO, codigo: "INVENTADO" }), ENV());
  eq(r.status, 401, "código errado é recusado");
  eq((await r.json()).erro, "codigo", "dizendo que é o código");
  eq(chamadas.length, 0, "e não gasta chamada no Gemini");

  r = await worker.fetch(pedido(CORPO, "https://site-qualquer.com"), ENV());
  eq(r.status, 403, "origem não liberada é recusada");
  eq(chamadas.length, 0, "também sem gastar chamada");

  r = await worker.fetch(pedido(CORPO, ORIGEM, "PUT"), ENV());
  eq(r.status, 405, "método esquisito é recusado");

  r = await worker.fetch(pedido({ ...CORPO, prompt: "" }), ENV());
  eq(r.status, 400, "pedido sem texto é recusado");

  r = await worker.fetch(pedido(CORPO), ENV({ GEMINI_KEY: "" }));
  eq(r.status, 500, "servidor sem chave avisa em vez de tentar");

  r = await worker.fetch(pedido(CORPO, ORIGEM, "OPTIONS"), ENV());
  eq(r.status, 204, "o preflight do navegador passa");
}

console.log("\n4. teto diário por aparelho");
{
  const KV = kvFalso(), env = ENV({ KV });
  geminiFalso(RESP("ok"));
  for (let i = 1; i <= 3; i++) {
    const r = await worker.fetch(pedido(CORPO), env);
    eq(r.status, 200, "pedido " + i + " de 3 passa");
  }
  const r = await worker.fetch(pedido(CORPO), env);
  eq(r.status, 429, "o quarto pedido é barrado");
  const d = await r.json();
  eq(d.erro, "cota", "dizendo que é a cota");
  ok(d.mensagem.includes("3"), "e informando o teto");
  eq(chamadas.length, 3, "o Gemini só foi chamado 3 vezes");

  // outro aparelho tem o proprio teto
  const r2 = await worker.fetch(pedido({ ...CORPO, aparelho: "ap2" }), env);
  eq(r2.status, 200, "outro aparelho tem teto próprio");
  // outro codigo tambem
  const r3 = await worker.fetch(pedido({ ...CORPO, codigo: "TURMA5B", aparelho: "ap1" }), env);
  eq(r3.status, 200, "e outro código também");
}

console.log("\n5. limites de tamanho");
{
  geminiFalso(RESP("ok"));
  const gigante = "x".repeat(200000);
  await worker.fetch(pedido({ ...CORPO, prompt: gigante }), ENV());
  ok(chamadas[0].body.contents[0].parts.at(-1).text.length <= 60000, "corta texto grande demais");

  geminiFalso(RESP("ok"));
  const fotos = Array.from({ length: 12 }, () => ({ tipo: "image/jpeg", dados: "AAAA" }));
  await worker.fetch(pedido({ ...CORPO, fotos }), ENV());
  const partes = chamadas[0].body.contents[0].parts.filter(p => p.inline_data);
  ok(partes.length <= 6, "no máximo seis fotos por pedido");

  geminiFalso(RESP("ok"));
  await worker.fetch(pedido({ ...CORPO, fotos: [{ tipo: "image/jpeg", dados: "A".repeat(3_000_000) }] }), ENV());
  eq(chamadas[0].body.contents[0].parts.filter(p => p.inline_data).length, 0, "descarta foto grande demais");
}

console.log("\n6. quando o Gemini falha");
{
  // 404 no primeiro modelo: tenta o proximo
  geminiFalso(u => u.includes("gemini-3.8-flash") ? jsonErro(404, "model not found") : RESP("veio do seguinte"));
  let r = await worker.fetch(pedido(CORPO), ENV());
  eq((await r.json()).texto, "veio do seguinte", "cai para o próximo modelo");
  eq(chamadas.length, 2, "depois de tentar dois");

  // chave recusada pelo Google
  geminiFalso(jsonErro(403, "API key not valid"));
  r = await worker.fetch(pedido(CORPO), ENV());
  eq((await r.json()).erro, "chave_servidor", "avisa que a chave do servidor foi recusada");

  // resposta cortada
  geminiFalso(jsonOk({ candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] }));
  r = await worker.fetch(pedido(CORPO), ENV());
  eq((await r.json()).erro, "cortado", "avisa quando a resposta vem pela metade");

  // recusa por seguranca
  geminiFalso(jsonOk({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }));
  r = await worker.fetch(pedido(CORPO), ENV());
  eq((await r.json()).erro, "recusado", "avisa quando a IA recusa o material");
}

console.log("\n7. vídeo e JSON");
{
  geminiFalso(RESP("resumo do vídeo"));
  await worker.fetch(pedido({ ...CORPO, video: "https://www.youtube.com/watch?v=abcdefghijk" }), ENV());
  ok(chamadas[0].body.contents[0].parts.some(p => p.file_data), "encaminha o vídeo do YouTube");

  geminiFalso(RESP('{"provas":[]}'));
  await worker.fetch(pedido({ ...CORPO, json: true }), ENV());
  eq(chamadas[0].body.generationConfig.responseMimeType, "application/json", "pede JSON quando o app pede");
}

console.log("\n8. a IA rapida (Groq) no servidor");
{
  /* um fetch falso que sabe distinguir os dois destinos */
  const GROQ = "CHAVE-RAPIDA-DO-SERVIDOR";
  const rGroq = t => jsonOk({ choices: [{ message: { content: t }, finish_reason: "stop" }] });
  function duplaFalsa(respGroq, respGemini) {
    chamadas = [];
    globalThis.fetch = async (url, opts) => {
      const u = String(url), alvo = u.includes("groq.com") ? "groq" : "gemini";
      chamadas.push({ alvo, url: u, headers: opts.headers, body: JSON.parse(opts.body) });
      const r = alvo === "groq" ? respGroq : respGemini;
      return typeof r === "function" ? r(u) : r;
    };
  }
  const soGroq = () => chamadas.filter(c => c.alvo === "groq");
  const soGemini = () => chamadas.filter(c => c.alvo === "gemini");
  const ENVR = extra => ENV({ GROQ_KEY: GROQ, ...extra });

  // texto puro vai na rapida
  duplaFalsa(rGroq("O roteiro ficou assim."), RESP("nao era para vir daqui"));
  let r = await worker.fetch(pedido(CORPO), ENVR());
  let d = await r.json();
  eq(r.status, 200, "texto puro responde 200");
  eq(d.texto, "O roteiro ficou assim.", "com a resposta da IA rapida");
  eq(d.ia, "groq", "dizendo que foi o Groq");
  eq(soGemini().length, 0, "e o Gemini nem foi chamado");
  eq(soGroq()[0].headers.Authorization, "Bearer " + GROQ, "usou a chave rapida do servidor");
  eq(soGroq()[0].body.messages[0].content, CORPO.prompt, "encaminhou o texto");
  ok(soGroq()[0].body.max_completion_tokens > 0, "com limite de saida");

  // a chave nao vaza
  ok(!(await (await worker.fetch(pedido(CORPO), ENVR())).text()).includes("CHAVE-RAPIDA"), "a chave rapida nao aparece na resposta");

  // foto e video pulam a rapida: o Groq nao enxerga
  duplaFalsa(rGroq("nao era para vir daqui"), RESP("li a foto"));
  r = await worker.fetch(pedido({ ...CORPO, fotos: [{ tipo: "image/jpeg", dados: "AAAA" }] }), ENVR());
  d = await r.json();
  eq(d.texto, "li a foto", "pedido com foto vai direto no Gemini");
  eq(d.ia, "gemini", "e diz que foi o Gemini");
  eq(soGroq().length, 0, "sem passar pela IA rapida");

  duplaFalsa(rGroq("nao era para vir daqui"), RESP("vi o video"));
  r = await worker.fetch(pedido({ ...CORPO, video: "https://www.youtube.com/watch?v=abcdefghijk" }), ENVR());
  eq((await r.json()).texto, "vi o video", "pedido com video tambem vai no Gemini");
  eq(soGroq().length, 0, "sem passar pela IA rapida");

  // quando a rapida tropeca, o Gemini assume sem o app perceber
  duplaFalsa(jsonErro(500, "instabilidade"), RESP("o Gemini resolveu"));
  r = await worker.fetch(pedido(CORPO), ENVR());
  d = await r.json();
  eq(d.texto, "o Gemini resolveu", "Groq fora do ar: o Gemini responde");
  eq(d.ia, "gemini", "e a resposta diz de onde veio");

  duplaFalsa(jsonErro(401, "chave invalida"), RESP("o Gemini resolveu"));
  eq((await (await worker.fetch(pedido(CORPO), ENVR())).json()).texto, "o Gemini resolveu", "chave rapida recusada nao quebra nada");
  eq(soGroq().length, 1, "e nao fica insistindo nos outros modelos");

  duplaFalsa(jsonOk({ choices: [{ message: { content: "metade da resp" }, finish_reason: "length" }] }), RESP("inteiro pelo Gemini"));
  eq((await (await worker.fetch(pedido(CORPO), ENVR())).json()).texto, "inteiro pelo Gemini", "resposta cortada na rapida vai refazer no Gemini");

  duplaFalsa(jsonOk({ choices: [{ message: { content: "   " }, finish_reason: "stop" }] }), RESP("inteiro pelo Gemini"));
  eq((await (await worker.fetch(pedido(CORPO), ENVR())).json()).texto, "inteiro pelo Gemini", "resposta em branco na rapida tambem");

  // modelo aposentado: tenta o proximo da lista
  let nG = 0;
  duplaFalsa(() => (++nG === 1 ? jsonErro(404, "decommissioned") : rGroq("veio do segundo modelo")), RESP("nao era para vir daqui"));
  d = await (await worker.fetch(pedido(CORPO), ENVR())).json();
  eq(d.texto, "veio do segundo modelo", "cai para o proximo modelo rapido");
  eq(soGroq().length, 2, "depois de tentar dois");
  ok(soGroq()[0].body.model !== soGroq()[1].body.model, "e sao modelos diferentes");

  // JSON e tamanho
  duplaFalsa(rGroq('{"provas":[]}'), RESP("x"));
  await worker.fetch(pedido({ ...CORPO, json: true }), ENVR());
  eq(soGroq()[0].body.response_format.type, "json_object", "pede JSON quando o app pede");

  duplaFalsa(rGroq("ok"), RESP("x"));
  await worker.fetch(pedido({ ...CORPO, prompt: "y".repeat(200000) }), ENVR());
  ok(soGroq()[0].body.messages[0].content.length <= 60000, "corta texto grande demais");

  // sem GROQ_KEY tudo segue como antes
  duplaFalsa(rGroq("nao era para vir daqui"), RESP("so Gemini aqui"));
  d = await (await worker.fetch(pedido(CORPO), ENV())).json();
  eq(d.texto, "so Gemini aqui", "sem a chave rapida, tudo vai no Gemini");
  eq(soGroq().length, 0, "sem tentar o Groq");

  // servidor so com a chave rapida: texto funciona, foto avisa
  duplaFalsa(rGroq("dei conta do texto"), RESP("nao era para vir daqui"));
  const SOR = ENV({ GEMINI_KEY: "", GROQ_KEY: GROQ });
  eq((await (await worker.fetch(pedido(CORPO), SOR)).json()).texto, "dei conta do texto", "so com a chave rapida, o texto funciona");
  r = await worker.fetch(pedido({ ...CORPO, fotos: [{ tipo: "image/jpeg", dados: "AAAA" }] }), SOR);
  eq(r.status, 500, "mas foto avisa que falta a chave que enxerga");
  eq((await r.json()).erro, "sem_chave", "dizendo que e falta de chave");

  // o teto diario conta tambem os pedidos rapidos
  const KV = kvFalso(), envT = ENVR({ KV });
  duplaFalsa(rGroq("ok"), RESP("x"));
  for (let i = 1; i <= 3; i++) eq((await worker.fetch(pedido(CORPO), envT)).status, 200, "pedido rapido " + i + " de 3 passa");
  eq((await worker.fetch(pedido(CORPO), envT)).status, 429, "o quarto e barrado pelo teto, mesmo sendo rapido");
  eq(soGroq().length, 3, "e a IA rapida so foi chamada 3 vezes");
}

console.log("\n9. quem abre o endereco no navegador");
{
  const APP = "https://sivicentes.github.io/apps-para-maes/semana-de-prova/";
  geminiFalso(RESP("nao era para vir daqui"));
  const r = await worker.fetch(pedido(null, ORIGEM, "GET"), ENV({ APP, GROQ_KEY: "CHAVE-RAPIDA" }));
  const html = await r.text();
  eq(r.status, 200, "GET no navegador responde 200, nao parece defeito");
  ok(String(r.headers.get("Content-Type")).includes("text/html"), "e devolve pagina, nao JSON");
  ok(!html.includes('"erro"'), 'sem a palavra "erro" na tela');
  ok(html.includes("est") && html.includes("no ar"), "dizendo que o servidor esta no ar");
  ok(html.includes("n&atilde;o &eacute; o aplicativo"), "e avisando que ali nao e o aplicativo");
  ok(html.includes('href="' + APP + '"'), "com o caminho para o aplicativo de verdade");
  eq(chamadas.length, 0, "sem gastar chamada de IA nenhuma");

  // a pagina nao conta nada de dentro
  ok(!html.includes("CHAVE-SECRETA") && !html.includes("CHAVE-RAPIDA"), "nenhuma chave na pagina");
  ok(!html.includes("TURMA4A") && !html.includes("CODIGOS"), "nenhum codigo de acesso na pagina");
  ok(!html.includes("GEMINI_KEY") && !html.includes("GROQ_KEY"), "nem o nome dos segredos");
  ok(html.includes("noindex"), "e pede para os buscadores nao indexarem");

  // HEAD nao devolve corpo
  const h = await worker.fetch(pedido(null, ORIGEM, "HEAD"), ENV({ APP }));
  eq(h.status, 200, "HEAD tambem responde 200");
  eq(await h.text(), "", "sem corpo");

  // sem APP configurado, a pagina ainda funciona
  const s = await worker.fetch(pedido(null, ORIGEM, "GET"), ENV());
  const semApp = await s.text();
  eq(s.status, 200, "sem APP configurado continua respondendo");
  ok(semApp.includes(ORIGEM), "caindo na origem liberada como destino");

  // origem desconhecida nao impede de ver que esta no ar
  const x = await worker.fetch(pedido(null, "https://site-qualquer.com", "GET"), ENV({ APP }));
  eq(x.status, 200, "quem abre de qualquer lugar ve a pagina");
  eq(chamadas.length, 0, "e nada disso chega perto da IA");
}

console.log("\n10. o servidor lembra o modelo que funcionou");
{
  const KV = kvFalso();
  const FOTO = { tipo: "image/jpeg", dados: "AAAA" };

  // primeiro pedido: o modelo mais novo nao existe nesta conta
  geminiFalso(u => u.includes("gemini-3.8-flash") ? jsonErro(404, "model not found") : RESP("li as paginas"));
  let r = await worker.fetch(pedido({ ...CORPO, fotos: [FOTO] }), ENV({ KV }));
  eq((await r.json()).modelo, "gemini-3.5-flash", "cai para o modelo seguinte");
  eq(chamadas.length, 2, "pagando uma chamada perdida, com as fotos junto");
  eq(await KV.get("modelo:gemini"), "gemini-3.5-flash", "e guarda qual funcionou");

  // segundo pedido: vai direto no que funcionou
  geminiFalso(u => u.includes("gemini-3.8-flash") ? jsonErro(404, "model not found") : RESP("li as paginas"));
  r = await worker.fetch(pedido({ ...CORPO, fotos: [FOTO] }), ENV({ KV }));
  eq((await r.json()).texto, "li as paginas", "responde igual");
  eq(chamadas.length, 1, "mas agora sem chamada perdida: as fotos sobem uma vez so");
  eq(chamadas[0].url.includes("gemini-3.5-flash"), true, "indo direto no modelo lembrado");

  // se o lembrado parar de funcionar, ele busca outro e troca a memoria
  geminiFalso(u => /gemini-3\.8-flash|gemini-3\.5-flash/.test(u) ? jsonErro(404, "gone") : RESP("veio do terceiro"));
  r = await worker.fetch(pedido(CORPO), ENV({ KV }));
  eq((await r.json()).texto, "veio do terceiro", "modelo aposentado nao trava o servidor");
  eq(await KV.get("modelo:gemini"), "gemini-flash-latest", "e a memoria passa a apontar para o novo");

  // a IA rapida tem memoria propria
  const KV2 = kvFalso(), GROQ = "CHAVE-RAPIDA";
  let n = 0;
  chamadas = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url); chamadas.push({ url: u, body: JSON.parse(opts.body) });
    if (!u.includes("groq.com")) return RESP("gemini");
    return ++n === 1 ? jsonErro(404, "decommissioned") : jsonOk({ choices: [{ message: { content: "ok rapido" }, finish_reason: "stop" }] });
  };
  r = await worker.fetch(pedido(CORPO), ENV({ KV: KV2, GROQ_KEY: GROQ }));
  eq((await r.json()).ia, "groq", "a IA rapida respondeu");
  const lembradoR = await KV2.get("modelo:groq");
  ok(!!lembradoR && lembradoR !== "llama-3.3-70b-versatile", "guardou o modelo rapido que funcionou");
  const antes = chamadas.length;
  await worker.fetch(pedido(CORPO), ENV({ KV: KV2, GROQ_KEY: GROQ }));
  eq(chamadas.length - antes, 1, "e o pedido seguinte vai direto nele");

  // sem KV ligado, tudo continua funcionando (so sem a memoria)
  geminiFalso(u => u.includes("gemini-3.8-flash") ? jsonErro(404, "x") : RESP("sem kv tambem vai"));
  r = await worker.fetch(pedido(CORPO), ENV());
  eq((await r.json()).texto, "sem kv tambem vai", "sem KV o servidor nao quebra");
}

globalThis.fetch = real;
console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
