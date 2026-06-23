/**
 * Espace Maths — Claude-generated step-by-step explanations.
 *
 * GeoGebra (client-side CAS) computes the authoritative answer; Claude explains
 * the worked steps *toward that answer* (anchored, so it can't invent a wrong
 * final result). Cheap model by default; swap via MATHS_LAB_MODEL.
 */
const Anthropic = require("@anthropic-ai/sdk");

// Lazy client: constructing Anthropic() throws when ANTHROPIC_API_KEY is unset,
// and this module is required at startup — so never construct eagerly.
let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _client = new Anthropic();
  return _client;
}
const MATHS_LAB_MODEL = process.env.MATHS_LAB_MODEL || "claude-haiku-4-5";

// Allow-listed operations (also the anti-abuse allow-list in the controller).
const OPERATIONS = {
  derivative: "la dérivée f'(x)",
  asymptotes: "les asymptotes de la courbe",
  limit: "la limite demandée",
  integral: "une primitive (intégrale) de f",
  variations: "le tableau de variation de f",
  solve: "la résolution de l'équation",
  factor: "la factorisation de l'expression",
  expand: "le développement de l'expression",
};

const SYSTEM_PROMPT = [
  "Tu es un professeur de mathématiques de lycée au Burkina Faso : clair, rigoureux et pédagogue.",
  "On te donne une fonction f(x), une opération à effectuer, et LE RÉSULTAT CORRECT déjà calculé.",
  "Ta tâche : expliquer, étape par étape et en français (niveau Terminale), le raisonnement qui mène EXACTEMENT à ce résultat.",
  "Règles impératives :",
  "- N'invente JAMAIS un résultat final différent de celui fourni ; ton explication doit y aboutir.",
  "- Écris les mathématiques en LaTeX SANS délimiteurs ($, \\[ \\]) dans les champs 'latex' et 'finalAnswerLatex'.",
  "- Reste concis : 2 à 6 étapes, chacune avec un titre court, l'expression LaTeX de l'étape, et une courte explication en français.",
  "- N'utilise que des notions de niveau lycée (règles de dérivation, limites, factorisation, etc.).",
].join("\n");

// Structured-outputs schema (all objects need additionalProperties:false).
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          latex: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["title", "latex", "explanation"],
        additionalProperties: false,
      },
    },
    finalAnswerLatex: { type: "string" },
  },
  required: ["steps", "finalAnswerLatex"],
  additionalProperties: false,
};

// Loose normalization for the soft "does Claude's final answer match the CAS" check.
function normalize(s) {
  return String(s || "")
    .replace(/\\left|\\right|\\,|\\;|\\!|\\quad|\\cdot|\\times/g, "")
    .replace(/[\s${}]/g, "")
    .replace(/\\/g, "")
    .toLowerCase();
}

/**
 * Returns { ok, steps, finalAnswerLatex, verified } or { ok:false, reason }.
 * Never throws — callers get a structured failure to fall back on.
 */
async function explainSteps({ functionStr, operation, casResult }) {
  const opLabel = OPERATIONS[operation] || operation;
  const userMsg =
    `Fonction : f(x) = ${functionStr}\n` +
    `Opération : calculer ${opLabel}.\n` +
    `Résultat correct (fourni — à expliquer, ne pas modifier) : ${casResult}\n\n` +
    `Donne les étapes du raisonnement qui mènent à ce résultat.`;

  const client = getClient();
  if (!client) return { ok: false, reason: "no_key" };

  try {
    const response = await client.messages.create({
      model: MATHS_LAB_MODEL,
      max_tokens: 2000,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refusal" };

    const block = (response.content || []).find((b) => b.type === "text");
    if (!block || !block.text) return { ok: false, reason: "empty" };

    let parsed;
    try {
      parsed = JSON.parse(block.text);
    } catch (e) {
      return { ok: false, reason: "parse" };
    }

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const finalAnswerLatex = parsed.finalAnswerLatex || casResult;
    const verified = normalize(finalAnswerLatex) === normalize(casResult);
    return { ok: true, steps, finalAnswerLatex, verified };
  } catch (err) {
    console.error("[mathsLab] Claude error:", err && err.message);
    return { ok: false, reason: "api_error" };
  }
}

module.exports = { explainSteps, MATHS_LAB_MODEL, OPERATIONS };
