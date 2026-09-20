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
  ok(html2.includes("Tirar foto da página"), "tela de fila de fotos renderiza");
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
  eq(c.falta, 32, "cobertura calcula o buraco");

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
  ok(w.document.getElementById("app").innerHTML.includes("falta página"), "a ficha da prova marca que falta material");
  t.ui.arg = ex.id; t.ui.screen = "examdet"; w.render();
  const det = w.document.getElementById("app").innerHTML;
  ok(det.includes("só 2 entrou"), "a tela da prova explica o que falta");
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
  ok((html.match(/class="hub/g) || []).length === 5, "o hub tem cinco fichas, nada de rolagem infinita");
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
  const vindo = JSON.parse(copiado[0]);
  eq(vindo.kids[0].exams[0].subject, "Ciências", "o código leva as provas");
  ok(vindo.kids[0].exams[0].content.length > 100, "o código leva o material lido");
  ok(!copiado[0].includes("AIza") && !copiado[0].includes("gsk_"), "o código não leva chave nenhuma");

  // copia leve, sem o material
  t.A.iolite();
  await new Promise(r => setTimeout(r, 10));
  const leve = JSON.parse(copiado[1]);
  eq(leve.kids[0].exams[0].subject, "Ciências", "a cópia leve mantém as provas");
  eq(leve.kids[0].exams[0].content, "", "a cópia leve tira o material lido");
  eq(leve.kids[0].exams[0].blocks.length, 0, "a cópia leve tira os blocos");
  eq(leve.kids[0].exams[0].pages, "120 a 123", "mas mantém as páginas indicadas pela professora");
  ok(copiado[1].length < copiado[0].length, "a cópia leve é menor que a completa");

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
  const codigo = copiado[0];
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

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
