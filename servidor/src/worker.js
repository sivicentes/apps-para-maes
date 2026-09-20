/* Porteiro do Gemini para o Semana de Prova.
 *
 * O aplicativo nunca ve a chave: ele manda o pedido para ca, este Worker
 * acrescenta a chave (guardada como secret na Cloudflare) e chama o Gemini.
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

export default {
  async fetch(req, env) {
    const origem = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos(origem, env) });
    if (req.method !== "POST") return resp({ erro: "metodo" }, 405, origem, env);
    if (!origemOk(origem, env)) return resp({ erro: "origem", mensagem: "Este endereco nao esta liberado." }, 403, origem, env);

    let p;
    try { p = await req.json(); } catch (e) { return resp({ erro: "json" }, 400, origem, env); }

    const codigo = String(p.codigo || "").trim();
    if (!codigoOk(codigo, env)) return resp({ erro: "codigo", mensagem: "Codigo de acesso invalido." }, 401, origem, env);
    if (typeof p.prompt !== "string" || !p.prompt.trim()) return resp({ erro: "vazio" }, 400, origem, env);
    if (!env.GEMINI_KEY) return resp({ erro: "sem_chave", mensagem: "O servidor esta sem a chave configurada." }, 500, origem, env);

    const c = await cota(env, codigo, String(p.aparelho || "").slice(0, 40));
    if (!c.ok) return resp({ erro: "cota", mensagem: "Limite de " + c.teto + " pedidos por dia atingido neste aparelho. Amanha volta.", usado: c.usado, teto: c.teto }, 429, origem, env);

    const base = montarPedido(p);
    const candidatos = [...new Set([p.modelo, ...MODELOS].filter(Boolean))].slice(0, 4);
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
        return resp({ texto, modelo, usado: c.usado, teto: c.teto, semContagem: c.semContagem }, 200, origem, env);
      }

      const err = await r.json().catch(() => ({}));
      const msg = (err.error && err.error.message) || "";
      if (r.status === 401 || r.status === 403) return resp({ erro: "chave_servidor", mensagem: "A chave do servidor foi recusada pelo Google." }, 502, origem, env);
      if (r.status === 429) { ultimo = { erro: "limite_google" }; continue; }
      if (r.status === 404 || r.status >= 500 || /model|not supported|not found/i.test(msg)) { ultimo = { erro: "upstream" }; continue; }
      return resp({ erro: p.video ? "video" : "upstream", mensagem: msg.slice(0, 200) }, 502, origem, env);
    }
    return resp(ultimo, 502, origem, env);
  },
};
