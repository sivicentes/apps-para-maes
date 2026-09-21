/* Porteiro das IAs para o Semana de Prova.
 *
 * O aplicativo nunca ve as chaves: ele manda o pedido para ca, este Worker
 * acrescenta a chave (guardada como secret na Cloudflare) e chama a IA.
 *
 * Quem atende o que:
 *   texto puro (roteiro, explicacao, quiz) -> Groq, que e bem mais rapido
 *   foto, PDF em imagem, video do YouTube  -> Gemini, o unico que enxerga
 * Sem GROQ_KEY configurada, tudo vai no Gemini como antes.
 *
 * Protecoes, da mais forte para a mais fraca:
 *   1. teto diario por aparelho e por codigo  -> e o que realmente segura
 *   2. limite de tamanho do pedido            -> evita abuso caro
 *   3. codigo de acesso                       -> obstaculo, nao seguranca:
 *      quem abrir o aplicativo consegue ler o codigo. Serve para revogar.
 *   4. checagem de origem                     -> so barra uso pelo navegador
 */

const GAPI = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODELOS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];

/* segunda IA: so texto, e bem mais rapida. Roteiro, explicacao e quiz
   passam por aqui quando a GROQ_KEY estiver configurada. */
const RAPI = "https://api.groq.com/openai/v1/chat/completions";
const RMODELOS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "qwen/qwen3-32b", "llama-3.1-8b-instant"];

const MAX_PROMPT = 60000;   // caracteres
const MAX_FOTOS = 6;
const MAX_FOTO = 2_800_000; // base64, ~2 MB de imagem

const lista = v => String(v || "").split(",").map(x => x.trim()).filter(Boolean);
const hoje = () => new Date().toISOString().slice(0, 10);

function cabecalhos(origem, env) {
  const ok = lista(env.ORIGENS);
  const permitida = ok.includes(origem) ? origem : (ok[0] || "*");
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}
const resp = (obj, status, origem, env) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cabecalhos(origem, env) } });

function origemOk(origem, env) {
  const ok = lista(env.ORIGENS);
  if (!ok.length) return true;           // sem lista configurada, nao barra
  return ok.includes(origem);
}
function codigoOk(codigo, env) {
  const ok = lista(env.CODIGOS);
  if (!ok.length) return true;           // sem codigos configurados, nao barra
  return ok.includes(codigo);
}

/* Qual modelo funcionou da ultima vez.
   Sem isto, cada pedido recomeca a lista do zero: se o primeiro modelo nao
   existir nesta conta, TODA leitura paga uma chamada perdida antes da boa — e
   numa leitura de paginas essa chamada perdida sobe as fotos de novo, que e o
   que realmente demora no celular. Guardado por um dia: se o Google publicar
   um modelo mais novo, o cache expira e a lista e testada outra vez. */
const LEMBRAR = 60 * 60 * 24;
async function modeloBom(env, qual) {
  if (!env.KV) return null;
  try { return await env.KV.get("modelo:" + qual); } catch (e) { return null; }
}
async function guardaModelo(env, qual, modelo) {
  if (!env.KV || !modelo) return;
  try { await env.KV.put("modelo:" + qual, modelo, { expirationTtl: LEMBRAR }); } catch (e) {}
}

/* Modelo que bateu no teto do Google fica de castigo, para nao ser tentado de
   novo a cada pedido. Isso importa muito numa leitura de paginas: a tentativa
   perdida sobe as fotos junto. No nivel gratuito o teto diario por modelo e
   baixo (20 pedidos/dia por modelo, 5 por minuto), entao cada modelo da
   familia Flash conta separado e vale a pena revezar entre eles. */
const eDoDia = msg => /per\s*day|daily|requests per day|RPD|quota.*day/i.test(String(msg || ""));
const ateAmanha = () => { const d = new Date(); const fim = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 8); return Math.max(3600, Math.round((fim - Date.now()) / 1000)); };
async function descansos(env) {
  if (!env.KV) return {};
  try {
    const o = JSON.parse((await env.KV.get("descansos")) || "{}"), agora = Date.now();
    return Object.fromEntries(Object.entries(o).filter(([, t]) => t > agora));
  } catch (e) { return {}; }
}
/* guarda no proprio objeto tambem, senao dois modelos que estouram no MESMO
   pedido se sobrescrevem e so o ultimo fica registrado */
async function poeDeCastigo(env, atuais, modelo, seg) {
  atuais[modelo] = Date.now() + seg * 1000;
  if (!env.KV) return;
  try { await env.KV.put("descansos", JSON.stringify(atuais), { expirationTtl: 60 * 60 * 30 }); } catch (e) {}
}
/* quem nao esta de castigo vem primeiro; os de castigo ficam no fim, nunca
   fora, para o app nao ficar sem resposta se todos estiverem no limite */
const ordemPorDescanso = (lista, parados) => [...lista.filter(m => !parados[m]), ...lista.filter(m => parados[m])];

/* teto diario por aparelho. Sem KV ligado, nao conta (e avisa na resposta). */
async function cota(env, codigo, aparelho) {
  if (!env.KV) return { ok: true, semContagem: true };
  const teto = Number(env.TETO_DIA || 120);
  const chave = "u:" + hoje() + ":" + codigo + ":" + (aparelho || "sem-id");
  const usado = Number((await env.KV.get(chave)) || 0);
  if (usado >= teto) return { ok: false, usado, teto };
  await env.KV.put(chave, String(usado + 1), { expirationTtl: 60 * 60 * 36 });
  return { ok: true, usado: usado + 1, teto };
}

function montarPedido(p) {
  const parts = [];
  if (p.video) parts.push({ file_data: { file_uri: String(p.video).slice(0, 300) } });
  for (const im of (Array.isArray(p.fotos) ? p.fotos : []).slice(0, MAX_FOTOS)) {
    if (!im || typeof im.dados !== "string" || im.dados.length > MAX_FOTO) continue;
    parts.push({ inline_data: { mime_type: String(im.tipo || "image/jpeg").slice(0, 40), data: im.dados } });
  }
  parts.push({ text: String(p.prompt).slice(0, MAX_PROMPT) });
  const g = p.json
    ? { responseMimeType: "application/json", maxOutputTokens: 8192 }
    : { maxOutputTokens: 4096 };
  return { contents: [{ role: "user", parts }], generationConfig: g };
}

function configModelo(g, modelo) {
  const c = { ...g };
  if (/^gemini-3/.test(modelo)) c.thinkingConfig = { thinkingLevel: "minimal" };
  else if (/^gemini-2\.5/.test(modelo)) c.thinkingConfig = { thinkingBudget: 0 };
  return c;
}

/* Quem abre este endereco no navegador faz um GET, e o Worker so conversa
   por POST. Em vez de devolver {"erro":"metodo"}, que parece defeito,
   devolve uma pagina dizendo que esta no ar e mandando para o aplicativo. */
function paginaDeStatus(env) {
  const app = String(env.APP || lista(env.ORIGENS)[0] || "").trim();
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    "<title>Semana de Prova &middot; servidor</title><style>" +
    ":root{--paper:#EEF3FA;--card:#fff;--ink:#1B2A4E;--ink2:#56637F;--line:#D3DDEC;--mark:#FFDF5E;--blue:#2B59E0}" +
    "@media(prefers-color-scheme:dark){:root{--paper:#141A28;--card:#1D2637;--ink:#EEF3FA;--ink2:#A9B6CE;--line:#2C3850}}" +
    "*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;" +
    "background:var(--paper);color:var(--ink);font:16px/1.6 'Nunito','Segoe UI',system-ui,sans-serif}" +
    ".c{background:var(--card);border:2px solid var(--line);border-radius:20px;padding:26px;max-width:460px;width:100%}" +
    "h1{font-size:1.35rem;margin:0 0 4px;line-height:1.25}" +
    ".mk{background:linear-gradient(transparent 58%,var(--mark) 58%);padding:0 3px}" +
    "p{margin:12px 0;color:var(--ink2)}.s{font-size:.88rem}" +
    "a.btn{display:block;text-align:center;margin-top:18px;background:var(--blue);color:#fff;text-decoration:none;" +
    "font-weight:700;border-radius:14px;padding:14px;min-height:52px}" +
    "</style></head><body><div class=c>" +
    "<h1>O servidor do <span class=mk>Semana de Prova</span> est&aacute; no ar ✅</h1>" +
    "<p>Esta p&aacute;gina n&atilde;o &eacute; o aplicativo. Este endere&ccedil;o &eacute; s&oacute; o porteiro: " +
    "ele guarda as chaves da intelig&ecirc;ncia artificial e responde ao aplicativo, nos bastidores.</p>" +
    "<p class=s>Se voc&ecirc; chegou aqui clicando num link, n&atilde;o tem nada para fazer nesta p&aacute;gina. " +
    "O endere&ccedil;o do servidor s&oacute; serve para ser colado dentro do aplicativo, em <b>Pais &rsaquo; Intelig&ecirc;ncia artificial &rsaquo; Servidor</b>.</p>" +
    (app ? '<a class=btn href="' + app.replace(/"/g, "") + '">Abrir o aplicativo</a>' : "") +
    "</div></body></html>";
  return html;
}

/* Tenta a IA rapida. So entra quando o pedido e texto puro: o Groq nao
   enxerga foto nem video. Qualquer tropeco devolve null sem barulho, e o
   pedido segue para o Gemini como sempre — o app nem fica sabendo. */
async function tentarGroq(p, env) {
  if (!env.GROQ_KEY) return null;
  if (p.video || (Array.isArray(p.fotos) && p.fotos.length)) return null;
  const lembrado = await modeloBom(env, "groq");
  const parados = await descansos(env);
  const todos = [...new Set([p.modeloRapido, lembrado, ...RMODELOS].filter(Boolean))];
  const candidatos = ordemPorDescanso(todos, parados).slice(0, 3);
  /* se todos os que seriam tentados estao de castigo, nem tenta: aqui
     existe o Gemini atras, e insistir so atrasaria a resposta */
  if (candidatos.every(m => parados[m])) return null;
  for (const modelo of candidatos) {
    let r;
    try {
      r = await fetch(RAPI, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.GROQ_KEY },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: "user", content: String(p.prompt).slice(0, MAX_PROMPT) }],
          max_completion_tokens: p.json ? 8192 : 4096,
          ...(p.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (e) { return null; }

    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      const c = (d.choices || [])[0];
      const texto = String((c && c.message && c.message.content) || "").trim();
      /* cortado ou em branco: o Gemini tem mais folego, deixa com ele */
      if (!texto || (c && c.finish_reason === "length")) return null;
      if (modelo !== lembrado) await guardaModelo(env, "groq", modelo);
      return { texto, modelo };
    }
    /* modelo aposentado ou minuto cheio: tenta o proximo da lista */
    if (r.status === 429) { await poeDeCastigo(env, parados, modelo, 90); continue; }
    if (r.status === 404 || r.status >= 500) continue;
    return null;   // chave recusada ou pedido invalido: nao insiste
  }
  return null;
}

export default {
  async fetch(req, env) {
    const origem = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos(origem, env) });
    if (req.method === "GET" || req.method === "HEAD") {
      return new Response(req.method === "HEAD" ? null : paginaDeStatus(env), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
    if (req.method !== "POST") return resp({ erro: "metodo" }, 405, origem, env);
    if (!origemOk(origem, env)) return resp({ erro: "origem", mensagem: "Este endereco nao esta liberado." }, 403, origem, env);

    let p;
    try { p = await req.json(); } catch (e) { return resp({ erro: "json" }, 400, origem, env); }

    const codigo = String(p.codigo || "").trim();
    if (!codigoOk(codigo, env)) return resp({ erro: "codigo", mensagem: "Codigo de acesso invalido." }, 401, origem, env);
    if (typeof p.prompt !== "string" || !p.prompt.trim()) return resp({ erro: "vazio" }, 400, origem, env);
    if (!env.GEMINI_KEY && !env.GROQ_KEY) return resp({ erro: "sem_chave", mensagem: "O servidor esta sem a chave configurada." }, 500, origem, env);

    const c = await cota(env, codigo, String(p.aparelho || "").slice(0, 40));
    if (!c.ok) return resp({ erro: "cota", mensagem: "Limite de " + c.teto + " pedidos por dia atingido neste aparelho. Amanha volta.", usado: c.usado, teto: c.teto }, 429, origem, env);

    /* texto puro vai primeiro na IA rapida; foto e video pulam direto */
    const rapido = await tentarGroq(p, env);
    if (rapido) return resp({ texto: rapido.texto, modelo: rapido.modelo, ia: "groq", usado: c.usado, teto: c.teto, semContagem: c.semContagem }, 200, origem, env);
    if (!env.GEMINI_KEY) return resp({ erro: "sem_chave", mensagem: "O servidor so tem a chave rapida, que nao le foto nem video." }, 500, origem, env);

    const base = montarPedido(p);
    const lembrado = await modeloBom(env, "gemini");
    const parados = await descansos(env);
    const candidatos = ordemPorDescanso([...new Set([p.modelo, lembrado, ...MODELOS].filter(Boolean))], parados).slice(0, 4);
    let ultimo = { erro: "upstream" };

    for (const modelo of candidatos) {
      const corpo = JSON.stringify({ ...base, generationConfig: configModelo(base.generationConfig, modelo) });
      let r;
      try {
        r = await fetch(GAPI + modelo + ":generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
          body: corpo,
        });
      } catch (e) { return resp({ erro: "offline" }, 502, origem, env); }

      if (r.ok) {
        const d = await r.json();
        const cand = d.candidates && d.candidates[0];
        const texto = ((cand && cand.content && cand.content.parts) || []).filter(x => !x.thought).map(x => x.text || "").join("").trim();
        const fim = (cand && cand.finishReason) || "";
        if (fim === "MAX_TOKENS") return resp({ erro: "cortado" }, 200, origem, env);
        if (!texto) {
          const bloqueio = (d.promptFeedback && d.promptFeedback.blockReason) || /SAFETY|PROHIBITED|BLOCK/.test(fim);
          return resp({ erro: bloqueio ? "recusado" : "vazio_ia" }, 200, origem, env);
        }
        if (modelo !== lembrado) await guardaModelo(env, "gemini", modelo);
        return resp({ texto, modelo, ia: "gemini", usado: c.usado, teto: c.teto, semContagem: c.semContagem }, 200, origem, env);
      }

      const err = await r.json().catch(() => ({}));
      const msg = (err.error && err.error.message) || "";
      if (r.status === 401 || r.status === 403) return resp({ erro: "chave_servidor", mensagem: "A chave do servidor foi recusada pelo Google." }, 502, origem, env);
      if (r.status === 429) {
        const dia = eDoDia(msg);
        await poeDeCastigo(env, parados, modelo, dia ? ateAmanha() : 90);
        ultimo = { erro: dia ? "limite_dia" : "limite_google", mensagem: msg.slice(0, 200) };
        continue;
      }
      if (r.status === 404 || r.status >= 500 || /model|not supported|not found/i.test(msg)) { ultimo = { erro: "upstream" }; continue; }
      return resp({ erro: p.video ? "video" : "upstream", mensagem: msg.slice(0, 200) }, 502, origem, env);
    }
    return resp(ultimo, 502, origem, env);
  },
};
