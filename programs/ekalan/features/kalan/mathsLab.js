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
// Function-analysis domain (default).
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

// Complex-numbers domain (Nombres complexes).
const COMPLEX_OPERATIONS = {
  modulus: "le module |z|",
  argument: "un argument de z",
  conjugate: "le conjugué de z",
  exp_form: "les formes trigonométrique et exponentielle de z",
  power: "la puissance z^n",
  nth_roots: "les racines n-ièmes",
  arithmetic: "le résultat de l'opération entre z₁ et z₂",
  triangle_nature: "la nature du triangle",
  quad_nature: "la nature du quadrilatère",
};

const SYSTEM_PROMPT_FUNCTION = [
  "Tu es un professeur de mathématiques de lycée au Burkina Faso : clair, rigoureux et pédagogue.",
  "On te donne une fonction f(x), une opération à effectuer, et LE RÉSULTAT CORRECT déjà calculé.",
  "Ta tâche : expliquer, étape par étape et en français (niveau Terminale), le raisonnement qui mène EXACTEMENT à ce résultat.",
  "Règles impératives :",
  "- N'invente JAMAIS un résultat final différent de celui fourni ; ton explication doit y aboutir.",
  "- Écris les mathématiques en LaTeX SANS délimiteurs ($, \\[ \\]) dans les champs 'latex' et 'finalAnswerLatex'.",
  "- Reste concis : 2 à 6 étapes, chacune avec un titre court, l'expression LaTeX de l'étape, et une courte explication en français.",
  "- N'utilise que des notions de niveau lycée (règles de dérivation, limites, factorisation, etc.).",
].join("\n");

const SYSTEM_PROMPT_COMPLEX = [
  "Tu es un professeur de mathématiques de Terminale au Burkina Faso, spécialiste du chapitre des NOMBRES COMPLEXES : clair, rigoureux et pédagogue.",
  "On te donne un (ou deux) nombre(s) complexe(s), une opération à effectuer, et LE RÉSULTAT CORRECT déjà calculé.",
  "Ta tâche : expliquer, étape par étape et en français, le raisonnement qui mène EXACTEMENT à ce résultat.",
  "Utilise les notions du chapitre : partie réelle/imaginaire, module |z|, argument arg(z), conjugué, forme algébrique/trigonométrique/exponentielle, formule de Moivre, racines n-ièmes.",
  "Pour la NATURE d'un triangle ou d'un quadrilatère défini par les affixes de ses points : calcule les longueurs avec les modules de différences (AB = |z_B - z_A|) et les angles avec les arguments de quotients (arg((z_C - z_A)/(z_B - z_A))) ; déduis les égalités de longueurs, le parallélisme et les angles droits, puis justifie la nature FOURNIE sans la changer.",
  "Règles impératives :",
  "- N'invente JAMAIS un résultat final différent de celui fourni ; ton explication doit y aboutir.",
  "- Écris les mathématiques en LaTeX SANS délimiteurs ($, \\[ \\]) dans les champs 'latex' et 'finalAnswerLatex'. Note l'unité imaginaire i et utilise e^{i\\theta} pour la forme exponentielle.",
  "- Reste concis : 2 à 6 étapes, chacune avec un titre court, l'expression LaTeX de l'étape, et une courte explication en français.",
].join("\n");

// French names for the arithmetic sub-operations between z₁ and z₂.
const ARITH_LABELS = {
  sum: "la somme z₁ + z₂",
  product: "le produit z₁ × z₂",
  quotient: "le quotient z₁ / z₂",
};

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

// Builds the per-domain system prompt + user message for the Claude call.
function buildPrompt({ domain, input, operation, casResult, params }) {
  if (domain === "complex") {
    const opLabel = COMPLEX_OPERATIONS[operation] || operation;

    // Geometry: input already lists the affixes ("z_A = … ; z_B = … ; …").
    if (operation === "triangle_nature" || operation === "quad_nature") {
      const geo = [
        `Points du plan complexe (affixes) : ${input}`,
        `Opération : déterminer ${opLabel}.`,
        `Résultat correct (fourni — à justifier, ne pas modifier) : ${casResult}`,
        ``,
        `Donne les étapes (longueurs via modules de différences, angles via arguments de quotients) qui justifient cette nature.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: geo.join("\n") };
    }

    const lines = [`z = z₁ = ${input}`];
    if (operation === "arithmetic") {
      lines[0] = `z₁ = ${input}`;
      if (params.z2) lines.push(`z₂ = ${params.z2}`);
      lines.push(`Opération : calculer ${ARITH_LABELS[params.arithOp] || opLabel}.`);
    } else if (operation === "power" || operation === "nth_roots") {
      lines.push(`n = ${params.n}`);
      lines.push(`Opération : calculer ${opLabel} (n = ${params.n}).`);
    } else {
      lines.push(`Opération : calculer ${opLabel}.`);
    }
    lines.push(
      `Résultat correct (fourni — à expliquer, ne pas modifier) : ${casResult}`,
      ``,
      `Donne les étapes du raisonnement qui mènent à ce résultat.`
    );
    return { system: SYSTEM_PROMPT_COMPLEX, userMsg: lines.join("\n") };
  }

  const opLabel = OPERATIONS[operation] || operation;
  const userMsg =
    `Fonction : f(x) = ${input}\n` +
    `Opération : calculer ${opLabel}.\n` +
    `Résultat correct (fourni — à expliquer, ne pas modifier) : ${casResult}\n\n` +
    `Donne les étapes du raisonnement qui mènent à ce résultat.`;
  return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
}

/**
 * Returns { ok, steps, finalAnswerLatex, verified } or { ok:false, reason }.
 * Never throws — callers get a structured failure to fall back on.
 *
 * domain: 'function' (default) or 'complex'. input = f(x) expression or z₁.
 * params: { z2, n, arithOp } for the complex domain.
 */
async function explainSteps({ domain = "function", input, operation, casResult, params = {} }) {
  const { system, userMsg } = buildPrompt({ domain, input, operation, casResult, params });

  const client = getClient();
  if (!client) return { ok: false, reason: "no_key" };

  try {
    const response = await client.messages.create({
      model: MATHS_LAB_MODEL,
      max_tokens: 2000,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
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

module.exports = { explainSteps, MATHS_LAB_MODEL, OPERATIONS, COMPLEX_OPERATIONS, ARITH_LABELS };
