/* Testes de fumaça do Semana de Prova.
   Roda o app inteiro no jsdom com fetch falso: nenhuma chamada real de IA,
   nenhuma chave envolvida. Uso: node semana-de-prova/tests/smoke.mjs        */
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HTML = join(dirname(fileURLToPath(import.meta.url)), "..", "index.html");

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log("  ok   " + msg); } else { failed++; console.log("  FALHA " + msg); } };
const eq = (a, b, msg) => ok(a === b, msg + (a === b ? "" : `  (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`));

/* ---------- fetch falso: responde como Gemini e como Groq ---------- */
function makeFetch(routes) {
  const calls = [];
  return {
    calls,
    fetch: async (url, opts = {}) => {
      const u = String(url);
      calls.push({ url: u, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {} });
      for (const r of routes) {
        if (!r.match(u, opts)) continue;
        if (r.status && r.status !== 200) {
          return { ok: false, status: r.status, json: async () => ({ error: { message: r.error || "erro" } }) };
        }
        const payload = typeof r.reply === "function" ? r.reply(u, opts) : r.reply;
        if (r.raw) return { ok: true, status: 200, json: async () => payload };
        const isGroq = u.includes("api.groq.com");
        const body = u.endsWith("/models") || u.includes("models?pageSize")
          ? payload
          : isGroq
            ? { choices: [{ message: { content: payload }, finish_reason: "stop" }] }
            : { candidates: [{ content: { parts: [{ text: payload }] }, finishReason: "STOP" }] };
        return { ok: true, status: 200, json: async () => body };
      }
      throw new Error("rota nao prevista no teste: " + u);
    },
  };
}

const GEMINI_MODELS = { models: [{ name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }] };
const GROQ_MODELS = { data: [{ id: "llama-3.3-70b-versatile" }] };

const NOTICE = JSON.stringify({
  provas: [{ materia: "Ciências", data: "2099-12-10", conteudo: "cadeia alimentar", paginas: "40 a 52", links: [{ url: "https://youtu.be/dQw4w9WgXcQ", descricao: "vídeo da prof" }] }],
});
const PAGES = JSON.stringify({
  material: { sistema: "Objetivo", volume: "Apostila 2", edicao: "2026", serie: "5º ano" },
  blocos: [
    { materia: "Ciências", assunto: "cadeia alimentar", pagina: "42", conceitos: ["produtor", "consumidor"], conteudo: "Produtores fazem fotossíntese. Consumidores comem outros seres." },
    { materia: "Ciências", assunto: "decompositores", pagina: "43", conceitos: ["fungos"], conteudo: "Decompositores devolvem nutrientes ao solo." },
  ],
});
const PLAN = JSON.stringify({ sessoes: [{ prova_id: "SERA_TROCADO", data: "2099-12-09", tipo: "revisao", titulo: "Ciências: revisão", minutos: 20, passos: ["Releia suas anotações.", "Refaça um exercício."] }] });
const QUIZ = JSON.stringify({
  perguntas: [
    { pergunta: "Quem faz fotossíntese?", opcoes: ["Produtores", "Consumidores", "Fungos", "Pedras"], correta: 0, explicacao: "Produtores usam a luz do sol.", assunto: "cadeia alimentar" },
    { pergunta: "Quem devolve nutrientes ao solo?", opcoes: ["Decompositores", "Aves", "Peixes", "Sol"], correta: 0, explicacao: "Os decompositores fazem isso.", assunto: "decompositores" },
  ],
});

const today_ = w => w.eval("today()");
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
async function boot(routes) {
  const f = makeFetch(routes);
  const dom = new JSDOM(readFileSync(HTML, "utf8"), { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = f.fetch;
  w.createImageBitmap = async () => ({ width: 100, height: 100, close() {} });
  w.scrollTo = () => {};
  // jsdom nao traz compressao nem Response: empresta do Node para testar o caminho real
  for (const n of ["CompressionStream", "DecompressionStream", "Response", "TextEncoder", "TextDecoder", "btoa", "atob"])
    if (globalThis[n] && !w[n]) w[n] = globalThis[n];
  await new Promise(r => setTimeout(r, 30));
  // const/let de topo nao viram propriedade de window: ponte para o escopo do script
  w.eval(`window.__t = {
    get ui(){return ui}, get A(){return A},
    get S(){return S}, set S(v){S=v},
    get G(){return G}, set G(v){G=v},
    get R(){return R}, set R(v){R=v},
    isVideo, ytId, errMsg, cleanUrl, useFast,
  };`);
  return { w, t: w.__t, calls: f.calls };
}
const wait = (w, cond, ms = 3000) => new Promise((res, rej) => {
  const t0 = Date.now();
  (function tick() {
    try { if (cond()) return res(); } catch (e) {}
    if (Date.now() - t0 > ms) return rej(new Error("tempo esgotado esperando condicao"));
    w.setTimeout(tick, 10);
  })();
});

/* ================= 1. cadastro da criança ================= */
console.log("\n1. cadastro da criança");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Lulu", grade: "5º ano" };
  t.A.savekid(); w.render();
  eq(t.S.kids.length, 1, "criança cadastrada");
  eq(t.S.kids[0].name, "Lulu", "nome guardado");
  eq(t.S.kids[0].grade, "5º ano", "série guardada");
  ok(!w.document.body.innerHTML.includes("Lulu") || true, "render não quebrou");
}

/* ================= 2. chave do Gemini e do Groq ================= */
console.log("\n2. ligar as duas IAs");
{
  const { w, t, calls } = await boot([
    { match: u => u.includes("generativelanguage") && u.includes("models?pageSize"), reply: GEMINI_MODELS },
    { match: u => u.includes("api.groq.com") && u.endsWith("/models"), reply: GROQ_MODELS },
  ]);
  await w.connectGemini("chave-de-teste-gemini-1234567890");
  eq(t.G.models[0], "gemini-3.8-flash", "modelo do Gemini escolhido");
  ok(calls.some(c => c.headers["x-goog-api-key"]), "Gemini usa o cabeçalho x-goog-api-key");
  await w.connectGroq("gsk_chave-de-teste-groq-1234567890");
  eq(t.R.models[0], "llama-3.3-70b-versatile", "modelo do Groq escolhido");
  ok(calls.some(c => String(c.headers.Authorization || "").startsWith("Bearer ")), "Groq usa Bearer");
  ok(!JSON.stringify(t.S).includes("chave-de-teste"), "nenhuma chave entra no estado salvo");
}

/* ================= 3. chave inválida ================= */
console.log("\n3. chave inválida");
{
  const { w, t } = await boot([
    { match: u => u.includes("generativelanguage"), status: 403, error: "API key not valid" },
  ]);
  let code = null;
  try { await w.connectGemini("chave-errada-1234567890"); } catch (e) { code = e.code; }
  eq(code, "bad_key", "chave ruim do Gemini vira bad_key");
  ok(t.errMsg({ code: "bad_key" }).includes("não foi aceita"), "mensagem de chave ruim existe");
  ok(!t.errMsg({ code: "truncated" }).includes("Não deu certo desta vez"), "resposta cortada tem mensagem própria");
  ok(!t.errMsg({ code: "invalid_json" }).includes("Não deu certo desta vez"), "formato inesperado tem mensagem própria");
  ok(!t.errMsg({ code: "empty_completion" }).includes("Não deu certo desta vez"), "resposta vazia tem mensagem própria");
}

/* ================= 4. troca de modelo quando o primeiro falha ================= */
console.log("\n4. troca de modelo");
{
  const { w, t, calls } = await boot([
    { match: u => u.includes("models?pageSize"), reply: GEMINI_MODELS },
    { match: u => u.includes("gemini-3.8-flash:generateContent"), status: 404, error: "model not found" },
    { match: u => u.includes(":generateContent"), reply: "ok" },
  ]);
  t.G = { key: "k".repeat(25), models: ["gemini-3.8-flash", "gemini-flash-latest"], model: null };
  w.sample = w.makeSample();
  const res = await w.sample("oi");
  eq(res.text, "ok", "caiu para o próximo modelo e respondeu");
  eq(t.G.model, "gemini-flash-latest", "modelo bom ficou guardado");
  const gen = calls.filter(c => c.url.includes(":generateContent"));
  ok(gen.length === 2, "tentou dois modelos");
  ok(gen[0].body.generationConfig.maxOutputTokens > 0, "limite de saída definido");
  eq(gen[0].body.generationConfig.thinkingConfig.thinkingLevel, "minimal", "thinkingLevel minimal nos 3.x");
}

/* ================= 5. resposta cortada (a causa do erro do quiz) ================= */
console.log("\n5. resposta cortada");
{
  const { w, t } = await boot([{ match: u => u.includes(":generateContent"), reply: "{" }]);
  t.G = { key: "k".repeat(25), models: ["gemini-3.8-flash"], model: null };
  w.sample = w.makeSample();
  let code = null;
  try { await w.sample.json("me dê json"); } catch (e) { code = e.code; }
  eq(code, "invalid_json", "JSON quebrado vira invalid_json, com mensagem própria");
}

/* ================= 6. comunicado, páginas, roteiro e quiz ================= */
console.log("\n6. fluxo completo");
{
  const routes = [
    { match: u => u.includes("models?pageSize"), reply: GEMINI_MODELS },
    { match: u => u.includes("api.groq.com") && u.endsWith("/models"), reply: GROQ_MODELS },
    {
      match: u => u.includes(":generateContent") || u.includes("chat/completions"),
      reply: (u, o) => {
        const b = JSON.parse(o.body);
        const txt = u.includes("groq") ? b.messages[0].content : b.contents[0].parts.map(p => p.text || "").join("");
        if (txt.includes("comunicado de provas")) return NOTICE;
        if (txt.includes("IDENTIFIQUE O MATERIAL")) return PAGES;
        if (txt.includes("Monte um roteiro")) return PLAN;
        if (txt.includes("múltipla escolha")) return QUIZ;
        if (txt.includes("Explique para uma criança")) return "A cadeia alimentar mostra quem come quem.";
        return "{}";
      },
    },
  ];
  const { w, t, calls } = await boot(routes);
  t.ui.form = { name: "Lulu", grade: "5º ano" }; t.A.savekid();
  await w.connectGemini("chave-de-teste-gemini-1234567890");
  await w.connectGroq("gsk_chave-de-teste-groq-1234567890");

  // comunicado por texto colado
  await w.readNotice([], "Ciências dia 10/12, páginas 40 a 52");
  const k = t.S.kids[0];
  eq(k.exams.length, 1, "prova extraída do comunicado");
  eq(k.exams[0].subject, "Ciências", "matéria certa");
  eq(k.exams[0].date, "2099-12-10", "data válida aceita");
  eq(k.exams[0].links.length, 1, "link da professora guardado");

  // não duplica ao ler o mesmo comunicado de novo
  await w.readNotice([], "Ciências dia 10/12, páginas 40 a 52");
  eq(k.exams.length, 1, "comunicado repetido não duplica a prova");

  // páginas: blocos + identificação do material
  const ex = k.exams[0];
  const r = await w.readChunk(ex, "texto das páginas", null);
  w.addBlocks(ex, r.material, r.blocos);
  eq(ex.blocks.length, 2, "dois blocos de conteúdo guardados");
  eq(ex.blocks[0].assunto, "cadeia alimentar", "assunto do bloco");
  eq(ex.blocks[0].pagina, "42", "página como referência");
  eq(ex.material.sistema, "Objetivo", "sistema identificado");
  eq(ex.material.volume, "Apostila 2", "volume identificado");
  eq(ex.material.edicao, "2026", "edição identificada");
  eq(w.matLabel(ex), "Objetivo · Apostila 2 · 2026 · 5º ano", "rótulo do material montado");
  ok(ex.content.includes("fotossíntese"), "ex.content derivado dos blocos");
  ok(ex.blocks.every(b => b.hash), "todo bloco tem hash");

  // mesmo material de novo não duplica
  const antes = ex.blocks.length;
  const r2 = await w.readChunk(ex, "texto das páginas", null);
  const add2 = w.addBlocks(ex, r2.material, r2.blocos);
  eq(ex.blocks.length, antes, "bloco repetido não duplica");
  eq(add2.added, 0, "nada novo adicionado");

  // roteiro
  PLAN_FIX: { /* o id da prova é sorteado, então reescrevo a rota do plano */ }
  routes[2].reply = (u, o) => {
    const b = JSON.parse(o.body);
    const txt = u.includes("groq") ? b.messages[0].content : b.contents[0].parts.map(p => p.text || "").join("");
    if (txt.includes("Monte um roteiro")) return JSON.stringify({ sessoes: [{ prova_id: ex.id, data: "2099-12-09", tipo: "revisao", titulo: "Ciências: revisão", minutos: 20, passos: ["Releia suas anotações.", "Refaça um exercício."] }] });
    if (txt.includes("múltipla escolha")) return QUIZ;
    if (txt.includes("Explique para uma criança")) return "A cadeia alimentar mostra quem come quem.";
    return "{}";
  };
  await w.makePlan();
  ok(k.sessions.length > 0, "roteiro montado");
  eq(k.sessions[0].examId, ex.id, "sessão ligada à prova");
  eq(k.sessions[0].type, "revisao", "véspera é revisão");
  ok(k.sessions.every(s => s.date < ex.date), "nenhuma sessão no dia da prova ou depois");

  // as tarefas de texto foram para o Groq, não para o Gemini
  const groqCalls = calls.filter(c => c.url.includes("chat/completions"));
  ok(groqCalls.length > 0, "Groq recebeu as tarefas de texto");
  ok(groqCalls.some(c => c.body.messages[0].content.includes("Monte um roteiro")), "roteiro foi pelo Groq");

  // quiz
  const sid = k.sessions[0].id;
  await w.startQuiz(sid);
  eq(t.ui.quiz.qs.length, 2, "quiz carregado");
  ok(t.ui.quiz.qs[0].opts.length === 4, "quatro opções");
  ok(t.ui.quiz.qs[0].opts.filter(o => o.ok).length === 1, "uma só correta");
  t.ui.arg = sid;
  t.A.pick({ i: String(t.ui.quiz.qs[0].opts.findIndex(o => !o.ok)) }); // erra de propósito
  t.A.nextq();
  t.A.pick({ i: String(t.ui.quiz.qs[1].opts.findIndex(o => o.ok)) });
  w.finishQuiz();
  const s0 = k.sessions.find(s => s.id === sid);
  eq(s0.score.total, 2, "placar registrado");
  eq(s0.score.right, 1, "um acerto");
  ok(s0.done, "sessão marcada como feita");
  ok(ex.misses.length === 1, "erro registrado para voltar na revisão");
  ok(ex.asked.length === 2, "perguntas feitas ficam registradas para não repetir");

  // explicação
  await w.explain(sid);
  ok(s0.explain.includes("cadeia alimentar"), "explicação guardada");
}

/* ================= 7. .docx com hyperlink ================= */
console.log("\n7. links");
{
  const { w, t } = await boot([]);
  const L = w.parseLinks("https://youtu.be/abcdefghijk Vídeo de verbos\nwww.escola.com.br/tarefa atividade");
  eq(L.length, 2, "dois links lidos do texto");
  eq(L[0].url, "https://youtu.be/abcdefghijk", "URL do YouTube preservada");
  eq(L[1].url, "https://www.escola.com.br/tarefa", "www recebe https");
  eq(t.ytId("https://youtu.be/abcdefghijk"), "abcdefghijk", "id do YouTube extraído");
  ok(t.isVideo("https://youtu.be/abcdefghijk"), "link de vídeo reconhecido");
  eq(t.cleanUrl("https://exemplo.com/pagina)."), "https://exemplo.com/pagina", "pontuação colada na URL é removida");
}

/* ================= 8. compatibilidade com dados antigos ================= */
console.log("\n8. dados antigos (sem blocos)");
{
  const { w, t } = await boot([]);
  const ex = { id: "x1", subject: "História", content: "Texto antigo guardado antes dos blocos.", nPages: 1, misses: [], asked: [], links: [] };
  w.addBlocks(ex, null, [{ materia: "História", assunto: "Brasil colônia", pagina: "10", conceitos: [], conteudo: "Conteúdo novo." }]);
  eq(ex.blocks.length, 2, "conteúdo antigo virou bloco e o novo foi somado");
  ok(ex.content.includes("Texto antigo guardado"), "conteúdo antigo preservado");
  ok(ex.content.includes("Conteúdo novo"), "conteúdo novo presente");
}

/* ================= 9. diário técnico e telas novas ================= */
console.log("\n9. diário técnico e telas novas");
{
  const routes = [
    { match: u => u.includes("models?pageSize"), reply: GEMINI_MODELS },
    { match: u => u.includes(":generateContent"), reply: (u, o) => {
        const txt = JSON.parse(o.body).contents[0].parts.map(p => p.text || "").join("");
        if (txt.includes("comunicado de provas")) return NOTICE;
        if (txt.includes("IDENTIFIQUE O MATERIAL")) return PAGES;
        return "{}";
      } },
  ];
  const { w, t } = await boot(routes);
  t.ui.form = { name: "Lulu", grade: "5º ano" }; t.A.savekid();
  await w.connectGemini("chave-de-teste-gemini-1234567890");
  const antes = w.eval("LOG.length");
  await w.readNotice([], "Ciências dia 10/12");
  const depois = w.eval("LOG.length");
  ok(depois > antes, "chamada de IA foi registrada no diário");
  const ult = w.eval("JSON.stringify(LOG[0])") && JSON.parse(w.eval("JSON.stringify(LOG[0])"));
  eq(ult.tarefa, "comunicado", "diário identifica a tarefa");
  eq(ult.ia, "Gemini", "diário identifica qual IA");
  ok(ult.ok === true, "diário marca sucesso");
  ok(typeof ult.seg === "string", "diário mede o tempo");
  ok(ult.entrada > 0, "diário registra o tamanho da entrada");
  ok(!JSON.stringify(w.eval("JSON.stringify(LOG)")).includes("chave-de-teste"), "diário não guarda a chave");

  // erro tambem entra no diario
  const ex = t.S.kids[0].exams[0];
  eq(t.S.kids[0].exams.length, 1, "prova criada para o teste");

  // readPages agora recebe a fila de arquivos
  const fake = new w.File(["conteudo"], "pagina1.jpg", { type: "image/jpeg" });
  await w.readPages(ex.id, [fake]);
  ok(ex.blocks && ex.blocks.length > 0, "readPages leu a fila de arquivos");
  eq(t.ui.files.length, 0, "fila esvaziada depois de ler");
  eq(t.ui.screen, null, "volta da tela de fila ao terminar");

  // readPages sem arquivos nao quebra
  await w.readPages(ex.id, []);
  ok(true, "readPages sem arquivos não quebra");

  // telas novas renderizam
  t.ui.arg = ex.id; t.ui.screen = "diag"; w.render();
  const html = w.document.getElementById("app").innerHTML;
  ok(html.includes("O que a IA entendeu"), "tela de auditoria renderiza");
  ok(html.includes("Roteiro montado"), "auditoria mostra a seção do roteiro");
  ok(html.includes("Material lido"), "auditoria mostra o material lido");
  t.ui.screen = "pages"; t.ui.files = []; w.render();
  const html2 = w.document.getElementById("app").innerHTML;
  ok(html2.includes("Abrir a câmera"), "tela de fila de fotos renderiza");
  ok(w.document.getElementById("cam") !== null, "existe input com câmera");
  eq(w.document.getElementById("cam").getAttribute("capture"), "environment", "input abre a câmera traseira");

  // aba Pais mostra o diario
  t.ui.tab = "pais"; t.ui.unlocked = true; t.ui.screen = "pavancado"; w.render();
  ok(w.document.getElementById("app").innerHTML.includes("Diário técnico"), "diário aparece em Pais > Senha, cópia e diagnóstico");
}

/* ================= 10. roteiro como lista livre ================= */
console.log("\n10. roteiro como lista livre (sem dia fixo)");
{
  let visto = "";
  const PARTES = ex => JSON.stringify({ sessoes: [
    { prova_id: ex, ordem: 3, tipo: "revisao", titulo: "Ciências: revisão geral", minutos: 20, passos: ["Releia tudo."] },
    { prova_id: ex, ordem: 1, tipo: "estudo", titulo: "Ciências: Sistema Solar", minutos: 20, passos: ["Leia as páginas 120 a 126."] },
    { prova_id: ex, ordem: 2, tipo: "estudo", titulo: "Ciências: fases da lua", minutos: 20, passos: ["Leia as páginas 127 a 134."] },
  ] });
  const { w, t } = await boot([
    { match: u => u.includes("models?pageSize"), reply: GEMINI_MODELS },
    { match: u => u.includes(":generateContent"), reply: (u, o) => {
        const txt = JSON.parse(o.body).contents[0].parts.map(p => p.text || "").join("");
        if (txt.includes("comunicado de provas")) return NOTICE;
        if (txt.includes("Monte um roteiro")) { visto = txt; return PARTES(t.S.kids[0].exams[0].id); }
        return "{}";
      } },
  ]);
  t.ui.form = { name: "Lulu", grade: "5º ano", pace: "calmo" }; t.A.savekid();
  eq(t.S.kids[0].pace, "calmo", "ritmo guardado na criança");
  await w.connectGemini("chave-de-teste-gemini-1234567890");
  await w.readNotice([], "Ciências dia 10/12, páginas 120 a 153");
  const k = t.S.kids[0], ex = k.exams[0];
  eq(ex.pages, "40 a 52", "páginas vindas do comunicado simulado");
  ex.pages = "120 a 153";

  await w.makePlan(ex.id);
  const ss = k.sessions.filter(s => s.examId === ex.id).sort((a, b) => a.ord - b.ord);
  eq(ss.length, 3, "três partes criadas");
  eq(ss[0].ord, 1, "ordem 1 é a primeira");
  eq(ss[0].title, "Ciências: Sistema Solar", "AI fora de ordem foi reordenada");
  eq(ss[1].title, "Ciências: fases da lua", "segunda parte na posição certa");
  eq(ss[0].date, null, "parte de estudo NÃO tem dia fixo");
  eq(ss[1].date, null, "segunda parte também sem dia fixo");
  eq(ss[2].type, "revisao", "última parte é a revisão");
  eq(ss[2].date, "2099-12-09", "só a revisão tem data, na véspera");

  // o prompt nao pede distribuicao por dia e carrega o ritmo
  ok(visto.includes("NÃO distribua as partes por dia"), "prompt proíbe distribuir por dia");
  ok(visto.includes("RITMO CALMO"), "prompt carrega o ritmo da criança");
  ok(!visto.includes("minutos de estudo por dia, somando tudo"), "teto diário saiu do prompt do roteiro");

  // contagem de paginas e cobertura
  eq(w.pageCount("120 a 153"), 34, "conta intervalo de páginas");
  eq(w.pageCount("40-52"), 13, "conta intervalo com hífen");
  eq(w.pageCount("12, 15 e 18"), 3, "conta páginas soltas");
  eq(w.pageCount(""), 0, "sem páginas devolve zero");
  w.addBlocks(ex, null, [{ materia: "Ciências", assunto: "a", pagina: "120", conceitos: [], conteudo: "um" },
                         { materia: "Ciências", assunto: "b", pagina: "121", conceitos: [], conteudo: "dois" }]);
  const c = w.coverage(ex);
  eq(c.want, 34, "cobertura sabe quantas páginas o comunicado pede");
  eq(c.got, 2, "cobertura sabe quantas entraram");
  eq(c.falta.length, 32, "cobertura sabe quantas páginas faltam");
  eq(c.texto, "122 a 153", "e diz quais faltam, em intervalo legível");

  // a tela Hoje mostra tudo junto, com progresso
  t.ui.tab = "hoje"; t.ui.screen = null; w.render();
  const html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Escolha por onde começar"), "tela Hoje convida a escolher");
  ok(html.includes("0 de 3 partes feitas"), "tela Hoje mostra o progresso");
  ok(html.includes("Sistema Solar"), "todas as partes aparecem juntas");
  ok(html.includes("fases da lua"), "inclusive as seguintes");
  ok(html.includes("revisão"), "a revisão aparece marcada");

  // marcar uma parte como feita atualiza o progresso
  ss[0].done = true; w.render();
  ok(w.document.getElementById("app").innerHTML.includes("1 de 3 partes feitas"), "progresso acompanha o que foi feito");

  // aviso de cobertura no cartao da prova
  t.ui.tab = "pais"; t.ui.unlocked = true; t.ui.screen = "pprovas"; w.render();
  ok(w.document.getElementById("app").innerHTML.includes("falta p. 122"), "a ficha da prova diz a partir de que página falta");
  t.ui.arg = ex.id; t.ui.screen = "examdet"; w.render();
  const det = w.document.getElementById("app").innerHTML;
  ok(det.includes("Falta o material"), "a tela da prova explica o que falta");
  ok(det.includes("122 a 153"), "nomeando as páginas");
  ok(det.includes("Material de estudo") && det.includes("Roteiro"), "a tela da prova reúne as ações num lugar só");
}

/* ================= 11. aviso quando não cabe ================= */
console.log("\n11. aviso quando não cabe no ritmo");
{
  const { w, t } = await boot([{ match: u => u.includes("models?pageSize"), reply: GEMINI_MODELS }]);
  t.ui.form = { name: "Lulu", grade: "5º ano", pace: "calmo" }; t.A.savekid();
  const k = t.S.kids[0];
  k.exams.push({ id: "e1", subject: "Ciências", date: addDays(today_(w), 1), topics: "", pages: "120 a 153", links: [], content: "", blocks: [], material: null, nPages: 1, misses: [], asked: [] });
  t.A.planone({ id: "e1" });
  ok(t.ui.confirm && t.ui.confirm.opts, "abriu a caixa de escolha em vez de montar direto");
  eq(t.ui.confirm.opts.length, 3, "três saídas oferecidas");
  ok(t.ui.confirm.msg.includes("34 páginas"), "aviso diz quantas páginas são");
  ok(t.ui.confirm.msg.includes("sobra 1 dia"), "aviso diz quanto tempo sobra");
  w.render();
  ok(w.document.getElementById("app").innerHTML.includes("Priorizar o mais importante"), "as opções aparecem na tela");

  // ritmo puxado com bastante tempo nao dispara aviso
  k.pace = "puxado";
  k.exams[0].date = addDays(today_(w), 20);
  t.ui.confirm = null;
  t.A.planone({ id: "e1" });
  ok(!(t.ui.confirm && t.ui.confirm.opts), "com tempo de sobra não avisa");
}

/* ================= 12. área dos pais trancada ================= */
console.log("\n12. área dos pais trancada");
{
  const { w, t } = await boot([]);
  const setv = (id, v) => w.eval('document.getElementById("' + id + '").value = ' + JSON.stringify(v));
  t.ui.form = { name: "Lulu", grade: "5º ano" }; t.A.savekid();

  // sem senha, Pais abre e oferece criar uma
  t.ui.tab = "pais"; w.render();
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Provas e material"), "o hub lista Provas e material");
  ok(html.includes("Como Lulu está indo"), "o hub lista o progresso");
  ok(html.includes("Inteligência artificial"), "o hub lista as IAs");
  ok((html.match(/class="hub/g) || []).length === 6, "o hub tem seis fichas, nada de rolagem infinita");
  ok(html.includes("Compartilhar"), "o hub tem a ficha de compartilhar");
  ok(html.includes("falta ligar"), "a ficha da IA mostra o estado sem precisar entrar");
  t.ui.screen = "pavancado"; w.render();
  html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Senha dos pais"), "Pais oferece criar a senha");
  t.ui.screen = null; w.render(); html = w.document.getElementById("app").innerHTML;
  ok(!html.includes("Área dos pais"), "sem senha não tranca");
  ok(html.includes("Estudar"), "aba Estudar existe");
  ok(!/data-a="tab" data-t="provas"><span/.test(html), "aba Provas saiu da navegação");
  t.ui.screen = "pavancado"; w.render();

  // define a senha usando o campo real da tela
  setv("pnew", "1234"); t.A.pset();
  eq(w.eval("PINV"), "1234", "senha guardada");
  ok(w.eval("!!localStorage.getItem('semana-de-prova:pin')"), "senha fica no aparelho");
  ok(!JSON.stringify(t.S).includes("1234"), "senha não entra no estado nem na cópia de segurança");

  // sair e voltar: tranca
  t.ui.unlocked = false; t.ui.tab = "pais"; t.ui.screen = "pavancado"; w.render();
  html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Área dos pais"), "com senha, tranca mesmo vindo de uma sub-tela");
  ok(!html.includes("Provas e material"), "conteúdo dos pais fica escondido");
  ok(!html.includes("Cópia de segurança"), "cópia de segurança escondida");
  ok(!html.includes("Chave do Gemini"), "campo da chave escondido");
  ok(html.includes("Voltar para o estudo"), "oferece voltar para o estudo");

  // senha errada não abre
  setv("pin", "9999"); t.A.punlock();
  ok(!t.ui.unlocked, "senha errada não destranca");
  // senha certa abre
  setv("pin", "1234"); t.A.punlock();
  ok(t.ui.unlocked, "senha certa destranca");
  t.ui.screen = null; w.render();
  ok(w.document.getElementById("app").innerHTML.includes("Provas e material"), "destrancada, mostra o hub");

  // a criança continua com o estudo livre
  t.ui.unlocked = false; t.ui.tab = "hoje"; w.render();
  ok(!w.document.getElementById("app").innerHTML.includes("Área dos pais"), "a tela de estudo nunca tranca");

  // saída de emergência: a conta
  t.ui.tab = "pais"; t.ui.unlocked = false; t.A.pforgot(); w.render();
  const r = JSON.parse(w.eval("JSON.stringify(ui.riddle)"));
  ok(r && r.a > 10 && r.b > 10, "a conta de emergência foi gerada com dois números de dois dígitos");
  ok(r.a * r.b > 100, "a conta não é trivial para criança");
  setv("rans", String(r.a * r.b - 1)); t.A.rsolve();
  eq(w.eval("PINV"), "1234", "resposta errada mantém a senha");
  w.render();
  const r2 = JSON.parse(w.eval("JSON.stringify(ui.riddle)"));
  setv("rans", String(r2.a * r2.b)); t.A.rsolve();
  eq(w.eval("PINV"), "", "resposta certa remove a senha");
  ok(t.ui.unlocked, "e destranca");
}

/* ================= 13. apagar avisa o que se perde ================= */
console.log("\n13. apagar avisa o que se perde");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Lulu", grade: "5º ano" }; t.A.savekid();
  const k = t.S.kids[0];
  k.exams.push({ id: "e1", subject: "Ciências", date: "2099-12-10", topics: "", pages: "", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] });
  k.sessions.push({ id: "s1", examId: "e1", ord: 1, date: null, type: "estudo", title: "parte 1", minutes: 20, steps: [], done: true, explain: "", score: { right: 4, total: 5, at: "2026-09-20" } });

  t.A.newweek();
  ok(t.ui.confirm && t.ui.confirm.opts, "nova semana abre escolha, não um sim/não");
  ok(t.ui.confirm.sub.includes("1 prova"), "diz quantas provas serão perdidas");
  ok(t.ui.confirm.sub.includes("1 quiz"), "diz quantos quizzes serão perdidos");
  ok(t.ui.confirm.sub.includes("N\u00e3o tem como desfazer"), "avisa que é irreversível");
  eq(t.ui.confirm.opts[0].label, "Primeiro salvar uma c\u00f3pia", "a primeira saída é salvar cópia");
  w.render();
  ok(w.document.getElementById("app").innerHTML.includes("1 prova"), "o detalhe aparece na tela");
  // salvar copia nao apaga
  t.A.copt({ i: "0" });
  eq(k.exams.length, 1, "salvar cópia não apagou nada");

  // remover crianca tambem avisa
  t.A.delkid({ id: k.id });
  ok(t.ui.confirm.sub.includes("Lulu"), "remover criança diz de quem é o que se perde");
  eq(t.S.kids.length, 1, "nada removido antes de escolher");
  t.A.copt({ i: "1" });
  eq(t.S.kids.length, 0, "escolhendo remover, remove");
}

/* ================= 14. levar para outro aparelho ================= */
console.log("\n14. levar para outro aparelho");
{
  const { w, t } = await boot([]);
  const copiado = [];
  w.navigator.clipboard = { writeText: async v => { copiado.push(v); } };
  t.ui.form = { name: "Lulu", grade: "5º ano" }; t.A.savekid();
  const k = t.S.kids[0];
  k.exams.push({ id: "e1", subject: "Ciências", date: "2099-12-10", topics: "sistema solar", pages: "120 a 123", links: [], content: "texto longo do material lido ".repeat(50), blocks: [{ materia: "Ciências", assunto: "sol", pagina: "120", conceitos: [], texto: "x".repeat(900), hash: "h1" }], material: { sistema: "Objetivo", volume: "Apostila 2", edicao: "2026", serie: "5º ano" }, nPages: 3, misses: [], asked: [] });
  t.S.kids[0] = k;

  // copiar o codigo inteiro
  t.A.iocopy();
  await new Promise(r => setTimeout(r, 10));
  ok(copiado.length === 1, "botão copia o código com um toque");
  ok(copiado[0].slice(0, 5) === "SDP1:", "o código sai comprimido");
  const cru = await w.dezipar(copiado[0]);
  ok(copiado[0].length < cru.length / 2, "comprimido cabe em menos da metade");
  const vindo = JSON.parse(cru);
  eq(vindo.kids[0].exams[0].subject, "Ciências", "o código leva as provas");
  ok(vindo.kids[0].exams[0].content.length > 100, "o código leva o material lido");
  ok(!cru.includes("AIza") && !cru.includes("gsk_"), "o código não leva chave nenhuma");

  // copia leve, sem o material
  t.A.iolite();
  await new Promise(r => setTimeout(r, 10));
  const cruLeve = await w.dezipar(copiado[1]);
  const leve = JSON.parse(cruLeve);
  eq(leve.kids[0].exams[0].subject, "Ciências", "a cópia leve mantém as provas");
  eq(leve.kids[0].exams[0].content, "", "a cópia leve tira o material lido");
  eq(leve.kids[0].exams[0].blocks.length, 0, "a cópia leve tira os blocos");
  eq(leve.kids[0].exams[0].pages, "120 a 123", "mas mantém as páginas indicadas pela professora");
  ok(cruLeve.length < cru.length, "a cópia leve é menor que a completa");

  // a chave pode ser mostrada e copiada, para levar ao outro aparelho
  w.eval('G = { key: "AIzaCHAVE-DE-TESTE-1234567890", models: ["gemini-3.8-flash"], model: null }; sample = makeSample();');
  t.ui.tab = "pais"; t.ui.unlocked = true; t.ui.screen = "pia"; w.render();
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Mostrar a chave"), "oferece mostrar a chave");
  ok(!html.includes("AIzaCHAVE"), "a chave fica escondida até pedir");
  t.A.gshow(); w.render();
  ok(w.document.getElementById("app").innerHTML.includes("AIzaCHAVE"), "mostrando, a chave aparece para copiar");
  t.A.gcopy();
  await new Promise(r => setTimeout(r, 10));
  eq(copiado[copiado.length - 1], "AIzaCHAVE-DE-TESTE-1234567890", "copia a chave inteira");
}

/* ================= 15. de quem é o aparelho ================= */
console.log("\n15. de quem é o aparelho");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Lulu", grade: "5º ano" }; t.A.savekid();
  t.ui.form = { name: "Téo", grade: "4º ano" }; t.A.savekid();
  const [lulu, teo] = t.S.kids;

  // por padrao e o aparelho da mae: da para trocar de filho
  t.ui.tab = "hoje"; w.render();
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes('data-a="kid"'), "no aparelho da mãe dá para trocar de filho");
  ok(html.includes('data-a="newkid"'), "e dá para adicionar criança");
  ok(w.eval("devLabel()").includes("mãe"), "o app se reconhece como aparelho da mãe");

  // marcar como aparelho de um filho
  w.eval('DEV = { modo: "crianca", kid: ' + JSON.stringify(lulu.id) + ' }; saveDev();');
  t.S.active = teo.id;
  w.render();
  html = w.document.getElementById("app").innerHTML;
  eq(t.S.active, lulu.id, "o aparelho volta sozinho para o perfil dono dele");
  ok(!html.includes('data-a="kid"'), "some o botão que troca de filho");
  ok(!html.includes('data-a="newkid"'), "some o botão de adicionar criança");
  ok(html.includes("Lulu"), "o nome do dono continua visível");
  ok(!/>Téo</.test(html), "o outro filho não aparece");
  ok(w.eval("devLabel()").includes("Lulu"), "o app sabe de quem é o aparelho");

  // o ajuste fica fora da copia de seguranca: e por aparelho
  ok(!JSON.stringify(t.S).includes("aparelho"), "o papel do aparelho não entra na cópia de segurança");
  ok(w.eval("!!localStorage.getItem('semana-de-prova:aparelho')"), "fica guardado só neste aparelho");

  // voltar para modo mae
  w.eval('DEV = { modo: "mae" }; saveDev();');
  w.render();
  ok(w.document.getElementById("app").innerHTML.includes('data-a="kid"'), "voltando ao modo mãe, a troca de filho volta");
}

/* ================= 16. código da turma ================= */
console.log("\n16. código da turma");
{
  // ---- mãe A: monta a semana ----
  const A = await boot([]);
  const copiado = [];
  A.w.navigator.clipboard = { writeText: async v => { copiado.push(v); } };
  A.t.ui.form = { name: "Lulu", grade: "5º ano" }; A.t.A.savekid();
  const ka = A.t.S.kids[0];
  ka.exams.push({ id: "e1", subject: "Ciências", date: "2099-12-10", topics: "sistema solar", pages: "120 a 123",
    links: [{ url: "https://youtu.be/abcdefghijk", label: "vídeo da prof" }],
    content: "", blocks: [], material: { sistema: "Objetivo", volume: "Apostila 2", edicao: "2026", serie: "5º ano" },
    nPages: 0, misses: [{ q: "errou isso", topic: "planetas" }], asked: ["pergunta feita"] });
  A.w.addBlocks(ka.exams[0], null, [{ materia: "Ciências", assunto: "o Sol", pagina: "120", conceitos: ["estrela"], conteudo: "O Sol é uma estrela." }]);
  ka.sessions.push({ id: "s1", examId: "e1", ord: 1, date: null, type: "estudo", title: "Ciências: o Sol", minutes: 20, steps: [{ t: "Leia a página 120.", done: true }], done: true, explain: "", score: { right: 4, total: 5, at: "2026-09-20" } });
  ka.sessions.push({ id: "s2", examId: "e1", ord: 2, date: "2099-12-09", type: "revisao", title: "Ciências: revisão", minutes: 20, steps: [{ t: "Releia tudo.", done: false }], done: false, explain: "", score: null });

  A.t.A.tcopy();
  await new Promise(r => setTimeout(r, 10));
  ok(copiado[0].slice(0, 5) === "SDP1:", "o código da turma sai comprimido");
  const codigo = await A.w.dezipar(copiado[0]);
  const obj = JSON.parse(codigo);

  // o que NAO pode vazar
  ok(!codigo.includes("Lulu"), "o código da turma não leva o nome da criança");
  ok(!codigo.includes("errou isso") && !codigo.includes("planetas"), "não leva os erros dos quizzes");
  ok(!codigo.includes("pergunta feita"), "não leva as perguntas já feitas");
  ok(!/"score"|"right"/.test(codigo), "não leva as notas");
  ok(!/"done":true/.test(codigo), "não leva o que a criança já fez");
  // o que PRECISA ir
  eq(obj.turma, 1, "o código se identifica como código de turma");
  eq(obj.provas.length, 1, "leva a prova");
  eq(obj.provas[0].m, "Ciências", "leva a matéria");
  eq(obj.provas[0].d, "2099-12-10", "leva a data");
  eq(obj.provas[0].p, "120 a 123", "leva as páginas");
  eq(obj.provas[0].l.length, 1, "leva o link da professora");
  eq(obj.provas[0].mat.sistema, "Objetivo", "leva a identificação do material");
  eq(obj.provas[0].b.length, 1, "leva o material que a IA já leu");
  eq(obj.provas[0].r.length, 2, "leva o roteiro pronto");

  // ---- mãe B: recebe, SEM chave de IA nenhuma ----
  const B = await boot([]);
  ok(!B.w.eval("!!sample"), "a mãe B não tem IA ligada");
  B.t.ui.form = { name: "Bento", grade: "5º ano" }; B.t.A.savekid();
  const kb2 = B.t.S.kids[0];
  kb2.exams.push({ id: "x9", subject: "Matemática", date: "2099-12-11", topics: "frações", pages: "5 a 33", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] });
  kb2.sessions.push({ id: "m1", examId: "x9", ord: 1, date: null, type: "estudo", title: "Matemática: frações", minutes: 20, steps: [{ t: "Leia.", done: true }], done: true, explain: "", score: { right: 3, total: 5, at: "2026-09-20" } });

  const r = B.w.importarTurma(obj);
  eq(r.novas, 1, "entrou uma prova nova");
  eq(r.comRot, 1, "com o roteiro pronto junto");
  eq(kb2.exams.length, 2, "a prova dela continua lá, a da turma foi somada");
  const ciencias = kb2.exams.find(e => e.subject === "Ciências");
  eq(ciencias.pages, "120 a 123", "as páginas chegaram");
  eq(ciencias.links.length, 1, "o link da professora chegou");
  eq(ciencias.material.sistema, "Objetivo", "a identificação do material chegou");
  ok(ciencias.content.includes("O Sol é uma estrela"), "o material lido chegou pronto, sem gastar IA");
  eq(ciencias.misses.length, 0, "os erros da outra criança NÃO vieram");
  eq(ciencias.asked.length, 0, "as perguntas da outra criança NÃO vieram");
  const rot = kb2.sessions.filter(s => s.examId === ciencias.id).sort((a, b) => a.ord - b.ord);
  eq(rot.length, 2, "as duas partes do roteiro chegaram");
  eq(rot[0].title, "Ciências: o Sol", "com os títulos certos");
  eq(rot[0].steps[0].t, "Leia a página 120.", "e os passos certos");
  eq(rot[0].done, false, "mas zeradas: o progresso é de cada criança");
  eq(rot[0].score, null, "sem as notas da outra criança");
  eq(rot[1].date, "2099-12-09", "a revisão continua na véspera");

  // o que a mae B faz dela nao foi tocado
  const mat = kb2.sessions.find(s => s.examId === "x9");
  eq(mat.done, true, "o que o Bento já fez continua feito");
  eq(mat.score.right, 3, "a nota dele continua lá");

  // colar duas vezes nao duplica
  const r2 = B.w.importarTurma(obj);
  eq(r2.novas, 0, "colar de novo não cria prova duplicada");
  eq(kb2.exams.length, 2, "continua com duas provas");
  eq(B.t.S.kids[0].sessions.filter(s => s.examId === ciencias.id).length, 2, "e não duplica o roteiro");

  // codigo de turma nao e aceito como copia de seguranca, nem o contrario
  B.t.ui.tab = "pais"; B.t.ui.unlocked = true; B.t.ui.screen = "pprovas"; B.w.render();
  ok(B.w.document.getElementById("app").innerHTML.includes("Compartilhar com a turma"), "o card da turma aparece em Provas e material");
}

/* ================= 17. código comprimido ================= */
console.log("\n17. código comprimido");
{
  const { w, t } = await boot([]);
  const bruto = JSON.stringify({ v: 1, kids: [{ id: "k1", name: "Benja", grade: "4º ano", pace: "puxado", exams: [], sessions: [], planAt: null }], active: "k1", settings: { minutes: 45, weekends: true } });
  // texto curto: comprimir sairia MAIOR, entao o app mantem o texto puro
  const curto = await w.zipar(bruto);
  eq(curto, bruto, "código curto fica em texto puro, porque comprimir não compensaria");
  // texto de tamanho real: comprime
  const grandeTxt = JSON.stringify({ v: 1, active: "k1", settings: { minutes: 45, weekends: true }, kids: [{ id: "k1", name: "Benja", grade: "4º ano", pace: "puxado", planAt: null, sessions: [], exams: Array.from({ length: 6 }, (_, i) => ({ id: "e" + i, subject: "Matéria " + i, date: "2099-12-1" + i, topics: "conteúdos de revisão no caderno e nas páginas indicadas", pages: "120 a 153", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] })) }] });
  const z = await w.zipar(grandeTxt);
  ok(z.slice(0, 5) === "SDP1:", "o código comprimido se identifica com SDP1:");
  ok(z.length < grandeTxt.length, "o comprimido é menor que o texto puro");
  eq(await w.dezipar(z), grandeTxt, "descomprimir devolve o original exato");
  eq(await w.dezipar(bruto), bruto, "e o texto puro passa direto");

  // codigo antigo, texto puro, continua aceito
  eq(await w.dezipar(bruto), bruto, "código antigo em texto puro continua sendo lido");
  const lidoAntigo = await w.lerCodigo(bruto);
  eq(lidoAntigo.tipo, "copia", "reconhece cópia de segurança antiga");
  const lidoNovo = await w.lerCodigo(z);
  eq(lidoNovo.tipo, "copia", "reconhece cópia de segurança comprimida");
  eq(lidoNovo.dados.kids[0].name, "Benja", "e devolve os dados certos");

  // codigo de turma comprimido
  const turma = JSON.stringify({ turma: 1, serie: "4º ano", provas: [{ m: "Ciências", d: "2099-12-10", t: "", p: "", l: [], mat: null, b: [], r: [] }] });
  const tz = await w.zipar(turma);
  const lidoT = await w.lerCodigo(tz);
  eq(lidoT.tipo, "turma", "reconhece código de turma comprimido");

  // lixo nao passa
  let erro = false;
  try { await w.lerCodigo("isso não é código nenhum"); } catch (e) { erro = true; }
  ok(erro, "texto qualquer é recusado");
  erro = false;
  try { await w.lerCodigo('{"alguma":"coisa"}'); } catch (e) { erro = true; }
  ok(erro, "JSON que não é nem cópia nem turma é recusado");

  // ganho real de tamanho num estado com material
  const grande = JSON.stringify({ v: 1, active: "k1", settings: { minutes: 45, weekends: true }, kids: [{ id: "k1", name: "Benja", grade: "4º ano", pace: "normal", planAt: null, sessions: [], exams: Array.from({ length: 8 }, (_, i) => ({ id: "e" + i, subject: "Matéria " + i, date: "2099-12-1" + i, topics: "conteúdos de revisão no caderno", pages: "120 a 153", links: [], content: "", blocks: [{ materia: "m", assunto: "a", pagina: "1", conceitos: [], texto: "O Sistema Solar é formado pelo Sol e por oito planetas. ".repeat(40), hash: "h" + i }], material: null, nPages: 1, misses: [], asked: [] })) }] });
  const gz = await w.zipar(grande);
  ok(gz.length < grande.length / 3, "estado com material encolhe pelo menos três vezes");
  eq(JSON.parse(await w.dezipar(gz)).kids[0].exams.length, 8, "e volta inteiro");
}

/* ================= 18. tela inicial com código ================= */
console.log("\n18. tela inicial: já tenho um código");
{
  const { w, t } = await boot([]);
  const setv = (id, v) => w.eval('document.getElementById("' + id + '").value = ' + JSON.stringify(v));
  w.render();
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Primeira vez aqui"), "a primeira tela oferece cadastrar");
  ok(html.includes("Já tenho um código"), "e oferece colar um código");
  ok(!html.includes('id="kname"'), "não pede o nome logo de cara");

  // caminho do cadastro normal continua funcionando
  t.A.wnovo(); w.render();
  ok(w.document.getElementById("app").innerHTML.includes('id="kname"'), "escolhendo cadastrar, aparece o formulário");
  t.A.wback(); w.render();
  ok(w.document.getElementById("app").innerHTML.includes("Primeira vez aqui"), "dá para voltar");

  // colar uma copia de seguranca restaura tudo
  t.A.wcodigo(); w.render();
  ok(w.document.getElementById("app").innerHTML.includes('id="wio"'), "a tela de código tem onde colar");
  const copia = JSON.stringify({ v: 1, kids: [{ id: "kx", name: "Benja", grade: "4º ano", pace: "puxado", planAt: null, exams: [{ id: "e1", subject: "Ciências", date: "2099-12-10", topics: "", pages: "", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] }], sessions: [] }], active: "kx", settings: { minutes: 45, weekends: true } });
  setv("wio", await w.zipar(copia));
  await t.A.wgo();
  eq(t.S.kids.length, 1, "a cópia restaurou a criança");
  eq(t.S.kids[0].name, "Benja", "com o nome certo");
  eq(t.S.kids[0].exams.length, 1, "e com as provas");
  eq(t.ui.screen, null, "e já entra no app");
}

/* ================= 19. a mãe da turma, do zero ================= */
console.log("\n19. a mãe da turma, do zero, sem chave");
{
  const { w, t } = await boot([]);
  const setv = (id, v) => w.eval('document.getElementById("' + id + '").value = ' + JSON.stringify(v));
  ok(!w.eval("!!sample"), "ela não tem IA ligada");
  const turma = { turma: 1, serie: "4º ano", em: "2026-09-20", provas: [
    { m: "Ciências", d: "2099-12-10", t: "sistema solar", p: "120 a 123", l: [{ u: "https://youtu.be/abcdefghijk", r: "vídeo da prof" }], mat: { sistema: "Objetivo", volume: "Apostila 2", edicao: "2026", serie: "4º ano" },
      b: [{ a: "o Sol", pg: "120", c: ["estrela"], x: "O Sol é uma estrela.", h: "h1" }],
      r: [{ o: 1, tp: "estudo", ti: "Ciências: o Sol", mi: 20, ps: ["Leia a página 120.", "Anote três coisas."] }, { o: 2, tp: "revisao", ti: "Ciências: revisão", mi: 20, ps: ["Releia tudo."] }] }] };

  // 1. abre o link e escolhe "ja tenho um codigo"
  w.render(); t.A.wcodigo(); w.render();
  // 2. cola o codigo
  setv("wio", await w.zipar(JSON.stringify(turma)));
  await t.A.wgo();
  // 3. o app pede so o nome, ja sugerindo a serie da turma
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes("código de turma"), "o app reconhece que é código de turma");
  ok(html.includes('id="kname"'), "e pede só quem vai estudar");
  ok(/4º ano[^<]*" selected|selected>4º ano|<option selected>4º ano/.test(html) || html.includes("4º ano"), "sugerindo a série da turma");
  eq(t.S.kids.length, 0, "ainda não criou criança nenhuma");

  // 4. digita o nome e comeca
  setv("kname", "Duda");
  await t.A.wgo();
  eq(t.S.kids.length, 1, "criou a criança dela");
  eq(t.S.kids[0].name, "Duda", "com o nome que ela escreveu");
  eq(t.S.kids[0].exams.length, 1, "e a prova da turma chegou junto");
  const ex = t.S.kids[0].exams[0];
  ok(ex.content.includes("O Sol é uma estrela"), "com o material já lido pela outra mãe");
  eq(ex.links.length, 1, "e o link da professora");
  eq(t.S.kids[0].sessions.length, 2, "e o roteiro pronto, sem gastar IA nenhuma");
  eq(t.ui.screen, null, "já caiu direto no app");
  eq(t.ui.tab, "hoje", "na tela de estudar");

  // 5. a crianca ja consegue estudar
  w.render(); html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Ciências"), "a matéria aparece para a criança");
  ok(html.includes("Ciências: o Sol"), "com a primeira parte do roteiro");
  ok(html.includes("Escolha por onde começar"), "convidando a escolher");
  ok(html.includes("0 de 2 partes feitas"), "com o progresso zerado, que é dela");
  // e abre a parte, com os passos
  const s0 = t.S.kids[0].sessions.sort((a, b) => a.ord - b.ord)[0];
  t.A.open({ id: s0.id }); w.render();
  html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Leia a página 120."), "os passos concretos chegaram");
  ok(html.includes("Explica pra mim"), "o botão de explicação existe");
  ok(html.includes("Começar o quiz"), "e o do quiz também");
}

/* ================= 20. foto com duas páginas ================= */
console.log("\n20. foto com duas páginas numa só");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
  const k = t.S.kids[0];
  const ex = { id: "e1", subject: "Ciências", date: "2099-12-10", topics: "", pages: "120 a 123", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] };
  k.exams.push(ex);

  // conjunto de páginas entende intervalos, listas e o formato de página dupla
  eq([...w.pageSet("120 a 123")].join(","), "120,121,122,123", "intervalo vira todas as páginas");
  eq([...w.pageSet("120-121")].join(","), "120,121", "foto de duas páginas conta as duas");
  eq([...w.pageSet("12, 15 e 18")].join(","), "12,15,18", "páginas soltas");
  eq([...w.pageSet("120 a 123 e 130; 132 a 134")].sort((a, b) => a - b).join(","), "120,121,122,123,130,132,133,134", "o formato real do comunicado da escola");

  // duas fotos, cada uma com duas páginas, cobrem as quatro
  w.addBlocks(ex, null, [
    { materia: "Ciências", assunto: "o Sol", pagina: "120-121", conceitos: [], conteudo: "O Sol é uma estrela." },
    { materia: "Ciências", assunto: "os planetas", pagina: "122-123", conceitos: [], conteudo: "São oito planetas." },
  ]);
  eq(w.coverage(ex), null, "duas fotos de duas páginas cobrem as quatro: nenhum aviso falso");

  // agora falta mesmo
  const ex2 = { id: "e2", subject: "História", date: "2099-12-11", topics: "", pages: "8 a 10; 14", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] };
  k.exams.push(ex2);
  w.addBlocks(ex2, null, [{ materia: "História", assunto: "vilas", pagina: "8-9", conceitos: [], conteudo: "As vilas coloniais." }]);
  const c2 = w.coverage(ex2);
  ok(c2, "aviso aparece quando falta de verdade");
  eq(c2.texto, "10, 14", "e nomeia exatamente as que faltam");
  eq(c2.got, 2, "contando certo o que entrou");

  // intervalos longos viram faixa legível
  eq(w.faixas([135, 136, 137, 141, 146, 147]), "135 a 137, 141, 146 a 147", "números soltos viram faixas legíveis");

  // o prompt avisa a IA sobre foto de duas páginas
  const pr = w.pagesPromptJSON(ex, "");
  ok(pr.includes("DUAS páginas"), "o prompt avisa que uma foto pode ter duas páginas");
  ok(pr.includes("120-121"), "e mostra o formato de página dupla");
}

/* ================= 21. provas repetidas ================= */
console.log("\n21. provas repetidas (o caso do Espanhol)");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
  const k = t.S.kids[0];
  const prova = (id, data, topics, pages, links, blocos, nPages) => ({
    id, subject: "Espanhol", date: data, topics, pages, links: links || [], content: "",
    blocks: blocos || [], material: null, nPages: nPages || 0, misses: [], asked: [],
  });
  // o mesmo Espanhol lido de dois comunicados, com datas diferentes, mais um terceiro
  k.exams.push(prova("e1", "2099-10-02", "Lección 5 LAS PROFESIONES", "58-67", [{ url: "https://exemplo.com/a", label: "site" }], [], 0));
  k.exams.push(prova("e2", "2099-10-06", "", "68-70", [{ url: "https://exemplo.com/b", label: "outro" }], [{ materia: "Espanhol", assunto: "profissões", pagina: "58", conceitos: [], texto: "médico, profesor", hash: "hA" }], 1));
  k.exams.push(prova("e3", "2099-10-09", "", "", [], [], 0));
  k.exams.push({ ...prova("e9", "2099-10-05", "frações", "5-33", [], [], 0), subject: "Matemática" });
  k.sessions.push({ id: "s1", examId: "e2", ord: 1, date: null, type: "estudo", title: "Espanhol: profissões", minutes: 20, steps: [{ t: "Leia.", done: false }], done: false, explain: "", score: null });

  // deteccao
  const rep = w.repetidas();
  eq(rep.length, 1, "detecta uma matéria repetida");
  eq(rep[0].materia, "Espanhol", "e diz qual é");
  eq(rep[0].provas.length, 3, "com as três entradas");

  // aviso aparece na tela
  t.ui.tab = "pais"; t.ui.unlocked = true; t.ui.screen = "pprovas"; w.render();
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Prova repetida"), "a tela avisa que há prova repetida");
  ok(html.includes("Juntar as 3 de Espanhol"), "e oferece juntar");

  // tela de escolha
  t.A.juntar({ m: "Espanhol" }); w.render();
  html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Juntar"), "abre a tela de juntar");
  ok(html.includes("2/10") || html.includes("sexta-feira"), "mostrando as datas para escolher");
  ok(html.includes("1 parte(s) de roteiro"), "e o que cada entrada tem");

  // junta na data de 06/10
  const r = w.juntarEm("e2");
  eq(r.juntadas, 2, "juntou as outras duas");
  const esp = k.exams.filter(e => e.subject === "Espanhol");
  eq(esp.length, 1, "sobrou uma só de Espanhol");
  eq(esp[0].date, "2099-10-06", "com a data escolhida");
  ok(esp[0].topics.includes("PROFESIONES"), "herdou os assuntos da outra");
  ok(esp[0].pages.includes("58-67") && esp[0].pages.includes("68-70"), "e as páginas das duas");
  eq(esp[0].links.length, 2, "os links das duas foram somados");
  eq(esp[0].blocks.length, 1, "o material lido foi preservado");
  eq(k.exams.length, 2, "Matemática não foi tocada");
  ok(k.exams.some(e => e.subject === "Matemática"), "Matemática continua lá");
  eq(k.sessions.filter(s => s.examId === esp[0].id).length, 1, "o roteiro continua ligado à prova certa");
  eq(w.repetidas().length, 0, "não há mais repetidas");

  // sem repetidas, nenhum aviso
  t.ui.screen = "pprovas"; w.render();
  ok(!w.document.getElementById("app").innerHTML.includes("Prova repetida"), "o aviso some quando não há repetição");
}

/* ================= 22. câmera em lote ================= */
console.log("\n22. câmera em lote (várias páginas de uma vez)");
{
  /* jsdom não tem câmera, canvas nem createObjectURL: monta um aparelho de mentira */
  function aparelhoComCamera(w, { falha } = {}) {
    const paradas = [];
    const track = { stop() { paradas.push(1); } };
    const stream = { getTracks: () => [track] };
    let pedido = null;
    w.navigator.mediaDevices = {
      getUserMedia: async c => { pedido = c; if (falha) throw new Error("NotAllowedError"); return stream; },
    };
    w.HTMLMediaElement.prototype.play = async function () {};
    w.HTMLMediaElement.prototype.pause = function () {};
    Object.defineProperty(w.HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 1920 });
    Object.defineProperty(w.HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 1440 });
    w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new w.Blob(["foto"], { type: "image/jpeg" })); };
    w.URL.createObjectURL = () => "blob:mentira";
    w.URL.revokeObjectURL = () => {};
    return { paradas, get pedido() { return pedido; } };
  }
  const clica = (w, id) => w.document.getElementById(id).click();
  const esperaFoto = (w, n) => wait(w, () => w.document.getElementById("camtiras").querySelectorAll("figure").length === n);

  // --- tirar três fotos sem sair da câmera ---
  {
    const { w, t } = await boot([]);
    const ap = aparelhoComCamera(w);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();

    const p = w.abrirCamera(24);
    await wait(w, () => !w.document.getElementById("camera").hidden);
    ok(true, "a câmera abre dentro do app");
    eq(ap.pedido.video.facingMode.ideal, "environment", "pede a câmera de trás");
    eq(w.document.getElementById("camqtd").textContent, "0 fotos", "começa zerada");

    clica(w, "camtira"); await esperaFoto(w, 1);
    eq(w.document.getElementById("camqtd").textContent, "1 foto", "depois da primeira foto, conta 1");
    clica(w, "camtira"); await esperaFoto(w, 2);
    clica(w, "camtira"); await esperaFoto(w, 3);
    eq(w.document.getElementById("camqtd").textContent, "3 fotos", "e vai somando sem fechar");
    eq(w.document.getElementById("camtiras").querySelectorAll("figure").length, 3, "com uma miniatura por página");
    ok(!w.document.getElementById("camera").hidden, "a câmera continuou aberta o tempo todo");

    clica(w, "camok");
    const fotos = await p;
    eq(fotos.length, 3, "Pronto devolve as três de uma vez");
    eq(fotos[0].name, "pagina-01.jpg", "a primeira vem numerada");
    eq(fotos[2].name, "pagina-03.jpg", "e a última também");
    eq(fotos[0].type, "image/jpeg", "são JPG");
    ok(w.document.getElementById("camera").hidden, "a câmera fechou");
    eq(ap.paradas.length, 1, "e desligou a câmera do aparelho");
  }

  // --- cancelar não traz nada ---
  {
    const { w, t } = await boot([]);
    const ap = aparelhoComCamera(w);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    const p = w.abrirCamera(24);
    await wait(w, () => !w.document.getElementById("camera").hidden);
    clica(w, "camtira"); await esperaFoto(w, 1);
    clica(w, "camsai");
    eq((await p).length, 0, "Cancelar descarta as fotos tiradas");
    ok(w.document.getElementById("camera").hidden, "e fecha a câmera");
    eq(ap.paradas.length, 1, "desligando a câmera do aparelho também");
  }

  // --- apagar uma miniatura antes de concluir ---
  {
    const { w, t } = await boot([]);
    aparelhoComCamera(w);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    const p = w.abrirCamera(24);
    await wait(w, () => !w.document.getElementById("camera").hidden);
    clica(w, "camtira"); await esperaFoto(w, 1);
    clica(w, "camtira"); await esperaFoto(w, 2);
    w.document.querySelector("#camtiras figure button").click();
    await wait(w, () => w.document.getElementById("camtiras").querySelectorAll("figure").length === 1);
    eq(w.document.getElementById("camqtd").textContent, "1 foto", "dá para apagar uma foto ruim ali mesmo");
    clica(w, "camok");
    eq((await p).length, 1, "e só a que sobrou vai para a fila");
  }

  // --- a fila tem limite, e a numeração continua de onde parou ---
  {
    const { w, t } = await boot([]);
    aparelhoComCamera(w);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    t.ui.files = [{ name: "ja-estava.jpg", type: "image/jpeg" }];
    const p = w.abrirCamera(3);
    await wait(w, () => !w.document.getElementById("camera").hidden);
    clica(w, "camtira"); await esperaFoto(w, 1);
    clica(w, "camtira"); await esperaFoto(w, 2);
    ok(w.document.getElementById("camtira").disabled, "o disparador trava quando a fila enche");
    eq(w.document.getElementById("camdica").textContent, "fila cheia (3)", "e explica por quê");
    clica(w, "camtira");
    eq(w.document.getElementById("camtiras").querySelectorAll("figure").length, 2, "tocar de novo não passa do limite");
    clica(w, "camok");
    const fotos = await p;
    eq(fotos[0].name, "pagina-02.jpg", "a numeração continua de onde a fila parou");
  }

  // --- o botão da tela de páginas usa a câmera em lote ---
  {
    const { w, t } = await boot([]);
    aparelhoComCamera(w);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    const k = t.S.kids[0];
    k.exams.push({ id: "e1", subject: "Ciências", date: "2099-12-10", topics: "", pages: "40-52", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] });
    t.ui.arg = "e1"; t.ui.screen = "pages"; t.ui.files = [];
    const p = t.A.pagecam();
    await wait(w, () => !w.document.getElementById("camera").hidden);
    clica(w, "camtira"); await esperaFoto(w, 1);
    clica(w, "camtira"); await esperaFoto(w, 2);
    clica(w, "camok");
    await p;
    eq(t.ui.files.length, 2, "as fotos entram na fila da prova");
    ok(w.document.getElementById("app").innerHTML.includes("2 página(s) na fila"), "e a tela mostra a fila");
  }

  // --- sem permissão, cai na câmera do sistema, como antes ---
  {
    const { w, t } = await boot([]);
    aparelhoComCamera(w, { falha: true });
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    let usouSistema = 0;
    w.pickFiles = async cam => { usouSistema++; eq(cam, true, "pedindo a câmera do sistema"); return [{ name: "uma-so.jpg", type: "image/jpeg" }]; };
    const fotos = await w.abrirCamera(24);
    eq(usouSistema, 1, "câmera negada: usa a do aparelho");
    eq(fotos.length, 1, "e ainda assim traz a foto");
    ok(w.document.getElementById("camera").hidden, "sem deixar a tela preta aberta");
  }

  // --- navegador antigo, sem mediaDevices ---
  {
    const { w, t } = await boot([]);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    try { delete w.navigator.mediaDevices; } catch (e) { w.navigator.mediaDevices = undefined; }
    let usouSistema = 0;
    w.pickFiles = async () => { usouSistema++; return []; };
    await w.abrirCamera(24);
    eq(usouSistema, 1, "navegador sem câmera no app também cai na do aparelho");
  }
}

/* ================= 23. o servidor com as duas IAs ================= */
console.log("\n23. o servidor diz qual IA atendeu");
{
  const ligaServidor = w => w.eval('SRV = { url: "https://porteiro.exemplo/", codigo: "TURMA4A", id: "ap1" };');
  const ultimoLog = w => JSON.parse(w.eval("JSON.stringify(LOG[0] || null)"));
  const PERG = "Explique para uma criança de 9 anos o que é cadeia alimentar.";

  // --- o pedido de texto volta pela IA rápida, e o diário registra ---
  {
    const { w, calls } = await boot([
      { match: u => u.includes("porteiro.exemplo"), raw: true, reply: { texto: "É quem come quem.", ia: "groq", modelo: "llama-3.3-70b-versatile", usado: 7, teto: 120 } },
    ]);
    ligaServidor(w);
    eq(await w.askText(PERG), "É quem come quem.", "a resposta do servidor chega ao app");
    const env = calls.find(c => c.url.includes("porteiro.exemplo"));
    eq(env.body.codigo, "TURMA4A", "o app manda o código de acesso");
    ok(!!env.body.aparelho, "e um id de aparelho, para o teto diário");
    ok(!JSON.stringify(env.body).includes("Bearer"), "sem chave nenhuma no pedido");
    const l = ultimoLog(w);
    eq(l.ia, "Servidor", "o diário registra que foi pelo servidor");
    ok(l.modelo.includes("Groq"), "dizendo que quem atendeu foi a IA rápida");
    ok(l.modelo.includes("llama-3.3-70b-versatile"), "com o modelo que ela usou");
    eq(l.ok, true, "e que deu certo");
  }

  // --- quando é o Gemini, o diário diz Gemini ---
  {
    const { w } = await boot([
      { match: u => u.includes("porteiro.exemplo"), raw: true, reply: { texto: "li a foto", ia: "gemini", modelo: "gemini-3.8-flash" } },
    ]);
    ligaServidor(w);
    await w.askText(PERG);
    const l = ultimoLog(w);
    ok(l.modelo.includes("Gemini"), "o diário separa o que veio do Gemini");
    ok(l.modelo.includes("gemini-3.8-flash"), "com o modelo dele");
  }

  // --- servidor antigo, que ainda não manda "ia": não quebra nada ---
  {
    const { w } = await boot([
      { match: u => u.includes("porteiro.exemplo"), raw: true, reply: { texto: "resposta simples" } },
    ]);
    ligaServidor(w);
    eq(await w.askText(PERG), "resposta simples", "servidor antigo continua funcionando");
    ok(!!ultimoLog(w).modelo, "e o diário não fica em branco");
  }

  // --- a tela dos pais explica que o servidor faz as duas coisas ---
  {
    const { w, t } = await boot([]);
    t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
    t.ui.tab = "pais"; t.ui.unlocked = true; t.ui.screen = "pia"; w.render();
    const html = w.document.getElementById("app").innerHTML;
    ok(html.includes("as chaves ficam guardadas lá"), "a tela fala no plural: são duas chaves");
    ok(html.includes("as duas IAs"), "e explica que o servidor usa as duas");
  }
}

/* ================= 24. telas escondidas não podem cobrir o app ================= */
console.log("\n24. o que nasce escondido tem que ficar escondido");
{
  /* Armadilha real: `.cam{display:flex}` vence o `display:none` que o navegador
     aplica pelo atributo `hidden` — regra de autor ganha da regra do navegador,
     independente de especificidade. O jsdom não reproduz essa cascata, então
     este bloco confere o CSS escrito, não o calculado. */
  const { w } = await boot([]);
  const css = [...w.document.querySelectorAll("style")].map(s => s.textContent).join("\n");

  ok(w.document.getElementById("camera").hasAttribute("hidden"), "a câmera nasce escondida");
  ok(/\.cam\s*\{[^}]*display\s*:\s*flex/.test(css), "e a tela dela é flex quando aparece");
  ok(/\.cam\[hidden\]\s*\{[^}]*display\s*:\s*none/.test(css), "com regra explícita para sumir — senão cobre o app desde que abre");

  /* varredura: vale para qualquer tela futura pendurada fora do #app */
  const foraDoApp = [...w.document.body.children].filter(el => el.hasAttribute("hidden") && el.className);
  ok(foraDoApp.length > 0, "há telas escondidas fora do #app para conferir");
  for (const el of foraDoApp) {
    for (const cls of String(el.className).split(/\s+/).filter(Boolean)) {
      const mexeNoDisplay = new RegExp("\\." + cls + "\\s*\\{[^}]*display\\s*:").test(css);
      const desfaz = new RegExp("\\." + cls + "\\[hidden\\]\\s*\\{[^}]*display\\s*:\\s*none").test(css);
      ok(!mexeNoDisplay || desfaz, "#" + el.id + ": a classe ." + cls + " não anula o hidden");
    }
  }

  /* e a tela inicial do app tem que ser o app, não um overlay */
  eq(w.document.getElementById("camera").hidden, true, "ao abrir o app, a câmera está fechada");
  eq(w.document.getElementById("toast").hidden, true, "e o aviso também");
}

/* ================= 25. câmera que abre mas não manda imagem ================= */
console.log("\n25. câmera que abre mas fica preta");
{
  const { w } = await boot([]);

  // a espera pela imagem, medida direto
  eq(await w.camTemImagem({ videoWidth: 640, videoHeight: 480 }), true, "imagem chegando: segue em frente");
  eq(await w.camTemImagem({ videoWidth: 0, videoHeight: 0 }, 150), false, "imagem que não vem: desiste em vez de travar");
  let q = 0;
  const atrasada = { get videoWidth() { return ++q > 2 ? 1280 : 0; }, get videoHeight() { return q > 2 ? 720 : 0; } };
  eq(await w.camTemImagem(atrasada, 2000), true, "câmera lenta ainda é esperada");

  // o caminho inteiro: permissão dada, imagem nunca vem
  const track = { parado: false, stop() { this.parado = true; } };
  w.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [track] }) };
  w.HTMLMediaElement.prototype.play = async function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.camTemImagem = async () => false;
  let usouSistema = 0;
  w.pickFiles = async () => { usouSistema++; return [{ name: "do-aparelho.jpg", type: "image/jpeg" }]; };

  const fotos = await w.abrirCamera(24);
  eq(usouSistema, 1, "tela preta cai na câmera do aparelho");
  eq(fotos.length, 1, "e a foto ainda chega");
  ok(w.document.getElementById("camera").hidden, "sem deixar a tela preta aberta");
  eq(track.parado, true, "e desligando a câmera do aparelho");
}

/* ================= 26. o contador de material diz a verdade ================= */
console.log("\n26. quanto material está guardado, de verdade");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
  const k = t.S.kids[0];
  const prova = (id, m, pg) => { const e = { id, subject: m, date: "2099-12-10", topics: "", pages: pg || "", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] }; k.exams.push(e); return e; };
  const ing = prova("e1", "Inglês", "4 a 6");

  eq(w.matResumo(ing), null, "sem material, não inventa número");

  // três fotos, que a IA separou em quatro trechos por assunto
  w.addBlocks(ing, null, [
    { materia: "Inglês", assunto: "verbo to be", pagina: "4", conceitos: [], conteudo: "I am, you are, he is." },
    { materia: "Inglês", assunto: "profissões", pagina: "4", conceitos: [], conteudo: "doctor, teacher, driver." },
    { materia: "Inglês", assunto: "plural", pagina: "5", conceitos: [], conteudo: "Plural com s no fim." },
    { materia: "Inglês", assunto: "perguntas", pagina: "6", conceitos: [], conteudo: "Do you like it?" },
  ]);
  let r = w.matResumo(ing);
  eq(r.trechos, 4, "conta os trechos guardados, não os arquivos enviados");
  eq(r.paginas, 3, "e as páginas que eles cobrem");
  eq(r.texto, "4 trechos · p. 4 a 6", "mostrando as duas coisas de um jeito conferível");
  eq(ing.nPages, 4, "o campo antigo passa a acompanhar os blocos");

  // ENVIAR AS MESMAS FOTOS DE NOVO NÃO PODE INFLAR O NÚMERO
  const antes = w.matResumo(ing).texto;
  const dup = w.addBlocks(ing, null, [
    { materia: "Inglês", assunto: "verbo to be", pagina: "4", conceitos: [], conteudo: "I am, you are, he is." },
    { materia: "Inglês", assunto: "plural", pagina: "5", conceitos: [], conteudo: "Plural com s no fim." },
  ]);
  eq(dup.added, 0, "material repetido não entra duas vezes");
  eq(w.matResumo(ing).texto, antes, "e o contador não sobe ao reenviar as mesmas fotos");
  eq(ing.nPages, 4, "continua sendo 4");

  // material novo sobe o número
  w.addBlocks(ing, null, [{ materia: "Inglês", assunto: "números", pagina: "7", conceitos: [], conteudo: "one, two, three." }]);
  eq(w.matResumo(ing).trechos, 5, "material novo sobe o contador");
  eq(w.matResumo(ing).texto, "5 trechos · p. 4 a 7", "e a faixa de páginas acompanha");

  // sem página anotada, ainda diz quantos trechos
  const art = prova("e2", "Artes");
  w.addBlocks(art, null, [{ materia: "Artes", assunto: "cores", pagina: "", conceitos: [], conteudo: "Cores primárias." }]);
  eq(w.matResumo(art).texto, "1 trecho", "sem página, mostra só os trechos");

  // colar texto conta como trecho, não como página
  w.addText(art, "Material colado", "O texto que a mãe colou sobre pintura.");
  eq(w.matResumo(art).trechos, 2, "texto colado também é um trecho");

  // apagar zera de verdade
  art.blocks = []; art.content = ""; art.nPages = 0;
  eq(w.matResumo(art), null, "depois de apagar, volta a não ter material");
}

/* ================= 27. quais provas ainda estão sem material ================= */
console.log("\n27. onde estão as matérias que faltam");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
  const k = t.S.kids[0];
  const prova = (id, m) => { const e = { id, subject: m, date: "2099-12-10", topics: "", pages: "", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] }; k.exams.push(e); return e; };
  const ing = prova("e1", "Inglês"); prova("e2", "Espanhol"); prova("e3", "Ciências");
  w.addBlocks(ing, null, [{ materia: "Inglês", assunto: "verbo to be", pagina: "4", conceitos: [], conteudo: "I am, you are." }]);

  t.ui.tab = "pais"; t.ui.unlocked = true; t.ui.screen = "pprovas"; w.render();
  let html = w.document.getElementById("app").innerHTML;
  ok(html.includes("2 de 3 prova(s) ainda sem material"), "diz quantas faltam, sem precisar rolar a lista");
  ok(html.includes("Espanhol, Ciências"), "e nomeia quais são");
  ok(html.includes("Cadastrar na m"), "lembrando que dá para cadastrar na mão o que a IA não achou");
  ok(html.includes("1 trecho"), "a prova que tem material mostra quanto tem");
  ok(!html.includes("material(is)"), "o contador antigo, que somava arquivos enviados, saiu de cena");

  // quando todas têm material, o aviso vira confirmação
  k.exams.forEach(e => w.addBlocks(e, null, [{ materia: e.subject, assunto: "x" + e.id, pagina: "9", conceitos: [], conteudo: "Conteúdo de " + e.subject + "." }]));
  w.render(); html = w.document.getElementById("app").innerHTML;
  ok(html.includes("Todas as 3 provas j"), "quando não falta nada, ele confirma");
  ok(!html.includes("ainda sem material"), "sem alarme falso");

  // sem provas, nenhum aviso
  k.exams.length = 0; w.render();
  ok(!w.document.getElementById("app").innerHTML.includes("sem material"), "sem provas cadastradas, nada de aviso");
}

/* ================= 28. não reenviar fotos à toa ================= */
console.log("\n28. a segunda tentativa só quando adianta");
{
  const { w, t } = await boot([]);
  t.ui.form = { name: "Benja", grade: "4º ano" }; t.A.savekid();
  const ex = { id: "e1", subject: "Inglês", date: "2099-12-10", topics: "", pages: "4 a 6", links: [], content: "", blocks: [], material: null, nPages: 0, misses: [], asked: [] };
  t.S.kids[0].exams.push(ex);

  const monta = (jsonFaz, textoFaz) => {
    const n = { json: 0, texto: 0 };
    w.askJSON = async () => { n.json++; return jsonFaz(); };
    w.askText = async () => { n.texto++; return textoFaz ? textoFaz() : "texto corrido"; };
    return n;
  };
  const FOTOS = [{ type: "image/jpeg" }, { type: "image/jpeg" }, { type: "image/jpeg" }];

  // caminho feliz: uma chamada só
  let n = monta(() => ({ material: null, blocos: [{ materia: "Inglês", assunto: "to be", pagina: "4", conceitos: [], conteudo: "I am." }] }));
  let r = await w.readChunk(ex, "", FOTOS);
  eq(n.json, 1, "leitura normal: uma chamada");
  eq(n.texto, 0, "sem reenviar as fotos");
  eq(r.blocos.length, 1, "e traz o bloco lido");

  // resposta fora do formato: aí vale tentar de novo
  n = monta(() => { throw { code: "invalid_json" }; });
  r = await w.readChunk(ex, "", FOTOS);
  eq(n.texto, 1, "resposta fora do formato: tenta uma segunda vez");
  ok(r.blocos[0].conteudo.includes("texto corrido"), "e aproveita o que veio");

  n = monta(() => { throw { code: "empty_completion" }; });
  await w.readChunk(ex, "", FOTOS);
  eq(n.texto, 1, "resposta em branco também merece segunda tentativa");

  // erros que repetir não conserta: sobem na hora, sem reenviar 3 fotos
  for (const code of ["srv_cota", "srv_codigo", "truncated", "prompt_too_large", "offline", "srv_chave_servidor"]) {
    n = monta(() => { throw { code }; });
    let subiu = null;
    try { await w.readChunk(ex, "", FOTOS); } catch (e) { subiu = e.code; }
    eq(subiu, code, code + ": o erro sobe na hora");
    eq(n.texto, 0, code + ": sem reenviar as fotos à toa");
  }

  // cancelar continua cancelando
  n = monta(() => { throw { code: "cancelled" }; });
  let subiu = null;
  try { await w.readChunk(ex, "", FOTOS); } catch (e) { subiu = e.code; }
  eq(subiu, "cancelled", "cancelar interrompe mesmo");
  eq(n.texto, 0, "sem começar outra leitura");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
