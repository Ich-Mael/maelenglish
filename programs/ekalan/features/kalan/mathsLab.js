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
  integral_def: "la valeur de l'intégrale définie",
  integral_ipp: "le calcul de l'intégrale par une intégration par parties",
  variations: "le tableau de variation de f",
  domain: "le domaine de définition de f",
  study: "l'étude complète de la fonction f",
  tangent: "l'équation de la tangente à la courbe",
  convexity: "la convexité et les points d'inflexion",
  suite_study: "l'étude de la suite numérique",
  binomial_law: "le calcul de probabilités avec la loi binomiale",
  conditional_prob: "le calcul de probabilités conditionnelles",
  stats_series: "les paramètres statistiques d'une série",
  stats_regression: "l'ajustement affine (régression linéaire)",
  diff_eq: "la résolution de l'équation différentielle",
  system: "la résolution du système d'équations linéaires",
  barycentre: "le barycentre de points pondérés",
  bary_locus: "l'ensemble des points M tels que ‖Σ aᵢ·MAᵢ‖ = k",
  eq2_solve: "la résolution de l'équation du second degré",
  eq2_param: "la discussion, selon le paramètre m, du nombre de solutions de l'équation",
  eq2_param_root: "les valeurs de m pour lesquelles x₀ est solution, et l'autre solution",
  eq3_root: "la recherche d'une racine évidente du polynôme de degré 3",
  eq3_quotient: "la factorisation P(x) = (x − x₀)·Q(x)",
  eq3_solveq: "la résolution de Q(x) = 0",
  eq3_solve: "la résolution complète de l'équation de degré 3",
  pw_study: "l'étude de la continuité et de la dérivabilité de la fonction définie par intervalles",
  pw_cont: "l'étude de la continuité de la fonction définie par intervalles",
  pw_deriv: "l'étude de la dérivabilité de la fonction définie par intervalles",
  pw_params: "la détermination des paramètres de la fonction définie par intervalles",
  arithmetique: "le calcul d'arithmétique",
  solve: "la résolution de l'équation",
  factor: "la factorisation de l'expression",
  expand: "le développement de l'expression",
};

// Complex-numbers domain (Nombres complexes).
const COMPLEX_OPERATIONS = {
  modulus: "le module |z|",
  argument: "un argument de z",
  conjugate: "le conjugué de z",
  algebraic_form: "la forme algébrique a + bi de z",
  trig_form: "la forme trigonométrique r(cos θ + i·sin θ) de z",
  exp_form: "les formes trigonométrique et exponentielle de z",
  power: "la puissance z^n",
  nth_roots: "les racines n-ièmes",
  arithmetic: "le résultat de l'opération entre z₁ et z₂",
  triangle_nature: "la nature du triangle",
  quad_nature: "la nature du quadrilatère",
  solve_poly: "les solutions de l'équation polynomiale",
  eval_at: "la valeur f(z₀)",
  find_root: "une racine réelle ou imaginaire pure",
  zf_xy: "la forme algébrique X + iY de Z = f(z)",
  zf_real: "l'ensemble des points M tels que Z soit réel",
  zf_imag: "l'ensemble des points M tels que Z soit imaginaire pur",
  zf_mod: "l'ensemble des points M tels que |Z| = k",
  zf_inv: "les points invariants de la transformation",
  zf_ante: "l'antécédent de Z₀ par la transformation",
  find_real_root: "une racine réelle",
  find_imag_root: "une racine imaginaire pure",
  quotient: "le quotient Q(z) tel que f(z) = (z − z₀)·Q(z)",
  solve_quotient: "les solutions de Q(z) = 0",
};

const SYSTEM_PROMPT_FUNCTION = [
  "Tu es un professeur de mathématiques de lycée au Burkina Faso : clair, rigoureux et pédagogue.",
  "On te donne une fonction f(x), une opération à effectuer, et LE RÉSULTAT CORRECT déjà calculé.",
  "Ta tâche : expliquer, étape par étape et en français (niveau Terminale), le raisonnement qui mène EXACTEMENT à ce résultat.",
  "Règles impératives :",
  "- N'invente JAMAIS un résultat final différent de celui fourni ; ton explication doit y aboutir.",
  "- Écris les mathématiques en LaTeX SANS délimiteurs ($, \\[ \\]) dans les champs 'latex' et 'finalAnswerLatex'. Dans 'explanation', écris du texte simple : toute formule LaTeX doit être entre $…$ (jamais de \\left, \\right, \\, ni de commande LaTeX hors des $), et pas de « \\n » : fais des phrases.",
  "- Donne TOUJOURS les valeurs sous forme EXACTE quand c'est possible : radicaux et fractions simplifiés (ex : \\pm\\sqrt{4/3} = \\pm\\dfrac{2\\sqrt{3}}{3}, et NON \\pm 1{,}155). Une valeur décimale approchée peut être ajoutée EN PLUS, précédée de \\approx.",
  "- Intervalles en notation française : le crochet d'une borne OUVERTE ou INFINIE se tourne vers l'extérieur (ex : ]-\\infty\\,;\\,2] et [0\\,;\\,+\\infty[), et les bornes sont séparées par un point-virgule (la virgule est le séparateur décimal).",
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
  "- Écris les mathématiques en LaTeX SANS délimiteurs ($, \\[ \\]) dans les champs 'latex' et 'finalAnswerLatex'. Note l'unité imaginaire i et utilise e^{i\\theta} pour la forme exponentielle. Dans 'explanation', écris du texte simple : toute formule LaTeX doit être entre $…$ (jamais de \\left, \\right, \\, ni de commande LaTeX hors des $), et pas de « \\n » : fais des phrases.",
  "- Reste concis : 2 à 6 étapes, chacune avec un titre court, l'expression LaTeX de l'étape, et une courte explication en français.",
].join("\n");

// French names for the arithmetic sub-operations between z₁ and z₂.
const ARITH_LABELS = {
  sum: "la somme z₁ + z₂",
  product: "le produit z₁ × z₂",
  quotient: "le quotient z₁ / z₂",
};

// Trigonometry domain — Claude computes the exact result itself, then explains.
const TRIG_OPERATIONS = {
  trig_equation: "résoudre l'équation trigonométrique sur un intervalle",
  trig_linearize: "linéariser l'expression",
  trig_duplicate: "développer avec les formules de duplication",
};

const SYSTEM_PROMPT_TRIG = [
  "Tu es un professeur de mathématiques de Terminale au Burkina Faso, spécialiste de la TRIGONOMÉTRIE : clair, rigoureux et pédagogue.",
  "On te donne une tâche de trigonométrie (résoudre une équation sur un intervalle, linéariser, ou développer avec les formules de duplication).",
  "Tu dois CALCULER toi-même le résultat exact, puis l'expliquer étape par étape en français (niveau Terminale).",
  "Règles impératives :",
  "- Donne un résultat EXACT et juste (valeurs remarquables, π, fractions, radicaux).",
  "- Écris les mathématiques en LaTeX SANS délimiteurs ($, \\[ \\]) dans les champs 'latex' et 'finalAnswerLatex'. Dans 'explanation', écris du texte simple : toute formule LaTeX doit être entre $…$ (jamais de \\left, \\right, \\, ni de commande LaTeX hors des $), et pas de « \\n » : fais des phrases.",
  "- Reste concis : 2 à 6 étapes, chacune avec un titre court, l'expression LaTeX de l'étape, et une courte explication en français.",
  "- Utilise les outils du chapitre : cercle trigonométrique, valeurs remarquables, formules d'addition et de duplication, linéarisation (formules d'Euler ou puissances de cos/sin).",
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

// LLMs often emit LaTeX with LONE backslashes inside their JSON (e.g. "\frac"),
// and because \f \b \n \r \t are *valid* JSON escapes, JSON.parse silently turns
// "\frac" into <formfeed>+"rac" instead of throwing — corrupting every command.
// Repair by escaping any backslash that isn't a valid JSON escape, while keeping
// already-correct "\\" pairs intact (protect → escape lone → restore). Idempotent.
function repairJsonBackslashes(text) {
  return String(text)
    .replace(/\\\\/g, " ")        // protect already-escaped backslashes
    .replace(/\\(?!["/u])/g, "\\\\")   // escape lone backslashes (LaTeX commands)
    .replace(/ /g, "\\\\");       // restore the protected pairs
}

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
  if (domain === "trig") {
    if (operation === "trig_equation") {
      const interval = (params && params.interval) || "ℝ";
      return { system: SYSTEM_PROMPT_TRIG, userMsg:
        `Équation trigonométrique : ${input}\n` +
        `Intervalle des solutions : ${interval}\n\n` +
        `Résous cette équation sur l'intervalle donné. Méthode : ramène-toi à une valeur remarquable, écris les solutions générales (avec 2kπ ou kπ + ... selon le cas), puis sélectionne uniquement celles qui appartiennent à l'intervalle. Dans 'finalAnswerLatex', donne l'ensemble des solutions sous la forme S = \\{ … \\}.` };
    }
    if (operation === "trig_linearize") {
      return { system: SYSTEM_PROMPT_TRIG, userMsg:
        `Expression à linéariser : ${input}\n\n` +
        `Linéarise cette expression : exprime-la comme une combinaison linéaire de cos(kx) et sin(kx), SANS puissances ni produits (utilise les formules d'Euler ou les formules de duplication). Dans 'finalAnswerLatex', écris l'égalité ${input} = (expression linéarisée).` };
    }
    return { system: SYSTEM_PROMPT_TRIG, userMsg:
      `Expression : ${input}\n\n` +
      `Développe cette expression à l'aide des formules de duplication et d'addition pour l'exprimer en fonction de cos(x) et sin(x) (angles simples). Dans 'finalAnswerLatex', écris l'égalité ${input} = (expression développée).` };
  }

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

    // Forme algébrique : développer/simplifier l'expression en a + bi (pas une équation).
    if (operation === "algebraic_form") {
      const e = [
        `Nombre complexe : z = ${input}`,
        `Opération : mettre z sous forme algébrique a + bi (a = partie réelle, b = partie imaginaire).`,
        `Résultat correct (fourni — à expliquer, ne pas modifier) : z = ${casResult}`,
        ``,
        `IMPORTANT : ce n'est PAS une équation à résoudre et z ne vaut PAS 0 — il s'agit simplement de SIMPLIFIER l'expression donnée. Développe les produits et les puissances, remplace i² par -1 (i³ = -i, i⁴ = 1…), puis regroupe la partie réelle et la partie imaginaire pour aboutir EXACTEMENT à ${casResult}. Ne remets pas en cause l'énoncé ni le résultat fourni.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }
    if (operation === "trig_form") {
      const e = [
        `Nombre complexe : z = ${input}`,
        `Opération : écrire z sous forme trigonométrique r(cos θ + i·sin θ).`,
        `Résultat correct (fourni — à expliquer, ne pas modifier) : z = ${casResult}`,
        ``,
        `Mets d'abord z sous forme algébrique a + bi si nécessaire, calcule le module r = |z| = √(a²+b²) et un argument θ tel que cos θ = a/r et sin θ = b/r, puis écris z = r(cos θ + i·sin θ). Aboutis exactement au résultat fourni. Ce n'est pas une équation à résoudre.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }

    // Transformation Z = f(z) (z = x + iy, Z = X + iY): forme algébrique, ensembles de points.
    if (/^zf_/.test(String(operation || ""))) {
      const goal = {
        zf_xy: "Déterminer la forme algébrique Z = X(x, y) + iY(x, y).",
        zf_real: "Déterminer l'ensemble des points M(z) tels que Z soit réel (Y = 0).",
        zf_imag: "Déterminer l'ensemble des points M(z) tels que Z soit imaginaire pur (X = 0).",
        zf_mod: "Déterminer l'ensemble des points M(z) tels que |Z| = k (caractérisation par le module).",
        zf_inv: "Déterminer les points invariants : résoudre f(z) = z.",
        zf_ante: "Déterminer le ou les antécédents de Z₀ : résoudre f(z) = Z₀.",
      }[operation];
      const e = [
        `Transformation : ${input}`,
        `Objectif : ${goal}`,
        `Résultats corrects déjà calculés (à expliquer, ne pas modifier) : ${casResult}`,
        ``,
        `Méthode attendue : poser z = x + iy (x, y réels) et Z = X + iY ; remplacer et développer ; pour un quotient, multiplier numérateur et dénominateur par le conjugué du dénominateur pour obtenir X et Y. ` +
          `Pour un ensemble de points : traduire la condition (Y = 0, X = 0, ou |Z|² = k²), exclure les points où f n'est pas définie, factoriser l'équation obtenue, puis reconnaître chaque partie : droite (équation réduite), cercle (mise sous forme canonique (x − a)² + (y − b)² = R² : centre et rayon), point ou ensemble vide. ` +
          `Pour |Z| = k avec Z = (z − a)/(z − b), interpréter aussi géométriquement (AM = k·BM ; médiatrice si k = 1). Conclure par une phrase donnant l'ensemble (avec les points exclus). ` +
          `Sois concis : 5 à 10 étapes, 2 à 3 phrases par étape, un calcul clé dans le champ latex. Aboutis EXACTEMENT aux résultats fournis.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }

    // Guided step-by-step resolution of a polynomial equation in ℂ.
    if (operation === "eval_at") {
      const e = [
        `Polynôme : f(z) = ${input}`,
        `Calcule f(z₀) avec z₀ = ${params.z0}.`,
        `Résultat correct (fourni — à expliquer, ne pas modifier) : f(z₀) = ${casResult}`,
        ``,
        `Montre le remplacement de z par z₀, le calcul des puissances de z₀ et le regroupement des parties réelle et imaginaire. Conclus clairement : si f(z₀) = 0, alors z₀ est une racine (solution) de l'équation f(z) = 0.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }
    if (operation === "find_root") {
      const e = [
        `Équation : f(z) = 0 avec f(z) = ${input}.`,
        `On cherche une solution RÉELLE (z = a, a réel) ou IMAGINAIRE PURE (z = i·b, b réel).`,
        `Solution correcte (fournie — à justifier, ne pas modifier) : z = ${casResult}`,
        ``,
        `Explique la méthode : poser z = a (ou z = i·b selon le cas), remplacer dans f(z), développer, puis séparer les parties réelle et imaginaire et résoudre le système { partie réelle = 0 ; partie imaginaire = 0 } pour obtenir cette racine.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }
    if (operation === "find_real_root") {
      const e = [
        `Équation : f(z) = 0 avec f(z) = ${input}.`,
        `On cherche une solution RÉELLE : z = x avec x réel.`,
        `Racine(s) réelle(s) correcte(s) (fournie(s) — à justifier, ne pas modifier) : ${casResult}`,
        ``,
        `Méthode attendue : poser z = x (x réel), remplacer dans f(z) et développer (z² = x², z³ = x³), puis regrouper partie réelle et partie imaginaire. Comme x est réel, f(x) = 0 équivaut au système { partie réelle = 0 ; partie imaginaire = 0 }. Résous l'équation la plus simple des deux (souvent du second degré), puis vérifie quelle(s) valeur(s) annule(nt) aussi l'autre équation. Conclus que z = ${casResult} est solution.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }
    if (operation === "find_imag_root") {
      const e = [
        `Équation : f(z) = 0 avec f(z) = ${input}.`,
        `On cherche une solution IMAGINAIRE PURE : z = i·y avec y réel non nul.`,
        `Racine(s) imaginaire(s) pure(s) correcte(s) (fournie(s) — à justifier, ne pas modifier) : ${casResult}`,
        ``,
        `Méthode attendue : poser z = i·y (y réel), remplacer dans f(z) en utilisant i² = −1 et i³ = −i (donc z² = −y² et z³ = −i·y³), développer, puis regrouper partie réelle et partie imaginaire. f(iy) = 0 équivaut au système { partie réelle = 0 ; partie imaginaire = 0 }. Résous l'équation la plus simple, vérifie la valeur de y dans l'autre, puis conclus que z = ${casResult} est solution.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }
    if (operation === "quotient") {
      const e = [
        `On sait que z₀ = ${params.z0} est une racine de f(z) = ${input}.`,
        `Détermine le polynôme Q(z) tel que f(z) = (z − z₀)·Q(z).`,
        `Quotient correct (fourni — à expliquer, ne pas modifier) : Q(z) = ${casResult}`,
        ``,
        `Présente les DEUX méthodes, clairement séparées, et aboutis EXACTEMENT à ce Q(z) dans chacune :`,
        `MÉTHODE 1 — Division euclidienne de f(z) par (z − z₀) : une étape par terme du quotient. À chaque étape, divise le terme de plus haut degré par z, multiplie (z − z₀) par ce terme, soustrais le produit et abaisse le terme suivant ; donne le reste partiel. Termine en montrant que le reste est 0. Préfixe le titre de ces étapes par « Méthode 1 — ».`,
        `MÉTHODE 2 — Identification des coefficients : pose Q(z) = αz² + βz + γ, développe (z − z₀)(αz² + βz + γ) et regroupe par puissances de z, écris le SYSTÈME de 4 équations obtenu par identification avec les coefficients de f(z) (dans le champ latex, utilise \\left\\{ \\begin{array}{l} … \\end{array} \\right.), puis résous-le de proche en proche (α, puis β, puis γ) et vérifie la 4ᵉ équation. Préfixe le titre de ces étapes par « Méthode 2 — ».`,
        `N'utilise jamais le titre « Division euclidienne » pour une étape d'identification (et inversement).`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }
    if (operation === "solve_quotient") {
      const e = [
        `Q(z) est le quotient de la division de f(z) = ${input} par (z − ${params.z0}).`,
        `Résous l'équation Q(z) = 0.`,
        `Solutions correctes et COMPLÈTES (fournies — ce sont les seules, à justifier sans les modifier) : ${casResult}`,
        ``,
        `Détermine d'abord Q(z) (un polynôme du second degré en général), puis résous Q(z) = 0 avec le discriminant Δ (éventuellement complexe) et ses racines carrées. Présente TOUTES les solutions explicitement sous forme a+bi (recopie-les), sans en inventer ni en oublier, et n'écris jamais une racine « à déterminer ».`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: e.join("\n") };
    }

    // Polynomial equation in ℂ: input is the polynomial (without "= 0").
    if (operation === "solve_poly") {
      const eq = [
        `Équation à résoudre dans l'ensemble ℂ des nombres complexes : ${input} = 0`,
        `Solutions correctes et COMPLÈTES (fournies — ce sont les seules, à justifier sans les modifier) : ${casResult}`,
        ``,
        `Donne les étapes de résolution adaptées au degré : recherche d'une racine évidente puis factorisation et division polynomiale ; pour un facteur du second degré, calcul du discriminant Δ (éventuellement complexe) et de ses racines carrées ; au besoin, forme exponentielle et racines n-ièmes.`,
        `IMPÉRATIF : utilise UNIQUEMENT les solutions fournies ci-dessus — n'en invente aucune et n'en oublie aucune. N'écris JAMAIS une racine comme « à déterminer », « z₃ = ... » non calculé, ou un symbole laissé en suspens : toutes les valeurs sont données, recopie-les explicitement. Si une solution fournie est numérique/approchée, présente-la telle quelle. Dans 'finalAnswerLatex', écris l'ensemble des solutions S = { ... } en listant toutes les valeurs fournies.`,
      ];
      return { system: SYSTEM_PROMPT_COMPLEX, userMsg: eq.join("\n") };
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

  // Integral: frame it as finding a primitive (readable for high-schoolers).
  if (operation === "integral") {
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : déterminer une primitive F de f (intégration).\n` +
      `Primitive correcte (fournie — à expliquer, ne pas modifier) : F(x) = ${casResult}\n\n` +
      `Explique simplement, niveau Terminale :\n` +
      `- rappelle qu'une primitive F vérifie F'(x) = f(x) ;\n` +
      `- utilise la linéarité de l'intégration et les primitives usuelles (x^n donne x^(n+1)/(n+1) si n ≠ -1, 1/x donne ln|x|, e^x reste e^x, cos donne sin, sin donne -cos, etc.) ;\n` +
      `- n'oublie pas la constante d'intégration k et vérifie en dérivant F.\n` +
      `Garde des étapes courtes et lisibles. Dans 'finalAnswerLatex', écris l'égalité avec le symbole intégrale et dx, en ajoutant la constante : \\int f(x)\\,dx = F(x) + k (F = la primitive ci-dessus, k réel).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Definite integral: primitive + fundamental theorem (F(b) − F(a)).
  if (operation === "integral_def") {
    const a = (params && params.a) || "a";
    const b = (params && params.b) || "b";
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : calculer l'intégrale définie de f entre ${a} et ${b}, soit ∫ de ${a} à ${b} de f(x) dx.\n` +
      `Résultat correct (fourni — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `Explique simplement, niveau Terminale :\n` +
      `- détermine d'abord une primitive F de f (linéarité + primitives usuelles) ;\n` +
      `- applique le théorème fondamental : l'intégrale de ${a} à ${b} de f vaut F(${b}) − F(${a}) ;\n` +
      `- calcule F(${b}) puis F(${a}) et fais la différence pour aboutir au résultat.\n` +
      `Dans 'finalAnswerLatex', écris l'égalité avec le symbole intégrale et les bornes : \\int_{${a}}^{${b}} f(x)\\,dx = ${casResult}.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Integration by parts: the choice of u / v' and every step are computed client-side (exact).
  if (operation === "integral_ipp") {
    const def = params && params.a && params.b;
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : ${def ? `calculer l'intégrale de ${params.a} à ${params.b} de f(x) dx` : "déterminer une primitive de f"} par intégration par parties.\n` +
      `Calcul correct (fourni — choix de u et v', étapes, résultat — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `Explique simplement, niveau Terminale :\n` +
      `- rappelle la formule : ∫ u(x)v'(x) dx = u(x)v(x) − ∫ u'(x)v(x) dx${def ? " (avec des crochets [u v] entre les bornes pour une intégrale définie)" : ""} ;\n` +
      `- justifie le choix de u et de v' (on dérive ce qui se simplifie : polynôme, ou ln ; on primitive ce qui reste simple : exponentielle, sin, cos, polynôme) ;\n` +
      `- calcule u', v puis applique la formule ; s'il y a plusieurs intégrations par parties, fais-les dans l'ordre ; si l'intégrale de départ réapparaît (e^x·cos x, e^x·sin x), isole-la ;\n` +
      `- ${def ? "évalue les crochets aux bornes ; pour combiner, utilise EXACTEMENT les valeurs intermédiaires fournies (« integrale restante … = … », « integrale de depart = … ») sans refaire l'arithmétique autrement, et conclus avec la valeur fournie" : "termine par la primitive fournie + une constante k, et vérifie en dérivant"}.\n` +
      `Dans 'finalAnswerLatex', écris l'égalité finale avec le symbole intégrale${def ? ` et les bornes ${params.a} et ${params.b}` : " et + k"}.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Limit: convey the target point + side so the explanation is precise.
  if (operation === "limit") {
    let where = "x tend vers la valeur demandée";
    if (params && params.point) {
      where = `x tend vers ${params.point}`;
      if (params.side === "+") where += " par valeurs supérieures (limite à droite)";
      else if (params.side === "-") where += " par valeurs inférieures (limite à gauche)";
    }
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : calculer la limite de f quand ${where}.\n` +
      `Résultat correct (fourni — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `Donne les étapes du raisonnement (forme indéterminée éventuelle, factorisation, quantité conjuguée, croissances comparées, limites usuelles…) qui mènent à ce résultat.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Complete function study: narrate the full étude from the computed results.
  if (operation === "study") {
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Résultats déjà calculés (à expliquer/commenter, ne pas modifier) :\n${casResult}\n\n` +
      `Rédige une ÉTUDE DE FONCTION claire et structurée, niveau Terminale, en t'appuyant sur ces résultats. Organise tes étapes ainsi : ` +
      `(1) domaine de définition et conditions d'existence ; (2) parité éventuelle ; (3) limites aux bornes et asymptotes (verticale, horizontale ou oblique) ; ` +
      `(4) dérivée f'(x) et étude de son signe ; (5) sens de variation et extrema ; (6) points caractéristiques (intersections avec les axes). ` +
      `IMPORTANT : ne dessine PAS de tableau de variation (ni en LaTeX array/matrice, ni en ASCII) — il est déjà affiché à l'élève ; décris le sens de variation uniquement en toutes lettres (« f croît sur …, décroît sur … »). ` +
      `Reste strictement cohérent avec les valeurs fournies (mêmes limites, mêmes extrema, même domaine). Dans 'finalAnswerLatex', donne une brève conclusion en TEXTE (pas de tableau ni d'array) résumant le sens de variation.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Arithmetic (série C).
  if (operation === "arithmetique") {
    const userMsg =
      `Calcul d'arithmétique : ${input}\n` +
      `Résultat correct (fourni — à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau Terminale (spécialité / série C), la méthode adaptée : algorithme d'Euclide pour le PGCD (divisions successives) ; PPCM = |ab| / PGCD ; ` +
      `algorithme d'Euclide étendu donnant l'identité de Bézout au + bv = PGCD(a,b) ; division euclidienne a = bq + r avec 0 ≤ r < |b| ; ` +
      `décomposition en produit de facteurs premiers ; calcul de congruence ou de puissance modulaire (exponentiation rapide, éventuellement petit théorème de Fermat). Aboutis EXACTEMENT au résultat fourni.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Differential equation.
  // Barycentre de points pondérés (+ ligne de niveau).
  if (operation === "barycentre" || operation === "bary_locus") {
    const extra = operation === "bary_locus"
      ? `Puis détermine l'ensemble des points M tels que ‖Σ aᵢ·MAᵢ‖ = k : réduis Σ aᵢ·MAᵢ en (Σ aᵢ)·MG grâce à la relation fondamentale (relation de Chasles), d'où |Σ aᵢ|·MG = k, et conclus (cercle de centre G et de rayon k/|Σ aᵢ|, point G si k = 0, ensemble vide si k < 0). Si la somme des poids est nulle, le vecteur est constant : conclus (tout le plan ou ensemble vide).`
      : `Explique la construction : pour 2 points, la relation vectorielle AG = b/(a+b)·AB ; pour 3 ou 4 points, l'associativité du barycentre (barycentres partiels) comme fourni.`;
    const userMsg =
      `Points pondérés : ${input}\n` +
      `Résultats corrects déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique pas à pas : condition d'existence (somme des poids non nulle), relation vectorielle définissant G (Σ aᵢ·GAᵢ = 0), relation fondamentale Σ aᵢ·MAᵢ = (Σ aᵢ)·MG pour tout point M, calcul des coordonnées x_G = (Σ aᵢ xᵢ)/(Σ aᵢ) et y_G de même. ` +
      `Si la somme des poids est nulle, explique qu'il n'y a pas de barycentre et que le vecteur Σ aᵢ·MAᵢ est constant. ${extra} ` +
      `Écris les vecteurs avec \\overrightarrow{GA} dans le champ latex. Sois concis : 5 à 9 étapes, 2 à 3 phrases par étape. Aboutis EXACTEMENT aux valeurs fournies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Système d'équations linéaires (2, 3 ou 4 inconnues).
  if (operation === "system") {
    const userMsg =
      `Système d'équations linéaires : ${input}\n` +
      `Résultats corrects déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique la résolution pas à pas. Pour 2 inconnues : présente la méthode par SUBSTITUTION (exprimer une inconnue à partir d'une équation, remplacer dans l'autre), puis la méthode par COMBINAISON linéaire (multiplier les équations pour éliminer une inconnue), et mentionne la méthode des déterminants (Cramer) si le déterminant est non nul. ` +
      `Pour 3 ou 4 inconnues : méthode du PIVOT DE GAUSS — reprends les opérations sur les lignes fournies (Lᵢ ← a·Lᵢ − b·Lⱼ) pour obtenir un système triangulaire, puis remonte (substitution) en partant de la dernière équation. ` +
      `Si le système est incompatible, montre la ligne « 0 = nombre non nul » ; s'il y a une infinité de solutions, exprime les inconnues en fonction des inconnues libres comme fourni. Termine par la vérification et l'ensemble S. ` +
      `Sois concis : 6 à 10 étapes, 2 à 3 phrases par étape, un calcul clé dans le champ latex (système : \\left\\{ \\begin{array}{l} … \\end{array} \\right.). Aboutis EXACTEMENT aux valeurs fournies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Équation : second degré, paramètre m, degré 3.
  if (/^eq[23]_/.test(String(operation || ""))) {
    const methods = {
      eq2_solve:
        "Méthode attendue : identifier a, b, c ; calculer le discriminant Δ = b² − 4ac en montrant la substitution ; selon le signe de Δ, donner les deux solutions x₁ = (−b − √Δ)/(2a) et x₂ = (−b + √Δ)/(2a), la solution double x₀ = −b/(2a), ou conclure S = ∅. Donne ensuite la forme factorisée a(x − x₁)(x − x₂) (si Δ ≥ 0) et le signe du trinôme (signe de a à l'extérieur des racines, signe contraire entre elles).",
      eq2_param:
        "Méthode attendue : 1) étudier d'abord le cas a(m) = 0, où l'équation devient du premier degré (la résoudre) ; 2) pour a(m) ≠ 0, calculer Δ(m) = b(m)² − 4a(m)c(m) en développant, puis étudier le signe de Δ(m) (racines de Δ(m), tableau de signes) ; 3) conclure : Δ(m) > 0 deux solutions distinctes — exprime-les EN FONCTION DE m, x = (−b(m) ± √Δ(m))/(2a(m)), en simplifiant comme fourni (facteur carré sorti de la racine, ou racine supprimée si Δ(m) est un carré parfait) ; Δ(m) = 0 une solution double x₀ = −b/(2a) ; Δ(m) < 0 aucune solution réelle. Donne les intervalles de m exactement comme fournis.",
      eq2_param_root:
        "Méthode attendue : x₀ est solution si et seulement si a(m)·x₀² + b(m)·x₀ + c(m) = 0 ; remplacer x par x₀, obtenir une équation en m et la résoudre. Pour chaque valeur de m trouvée (avec a(m) ≠ 0), déterminer l'autre solution grâce à la somme des racines x₀ + x₁ = −b/a (ou au produit x₀·x₁ = c/a).",
      eq3_root:
        "Méthode attendue : chercher une racine évidente en calculant P(1), P(−1), P(2), P(−2)… (puis, si besoin, des fractions p/q où p divise d et q divise a) jusqu'à trouver P(x₀) = 0 ; montrer le calcul de P(x₀) = 0 et conclure que P(x) se factorise par (x − x₀).",
      eq3_quotient:
        "Présente les DEUX méthodes, clairement séparées (titres préfixés « Méthode 1 — » et « Méthode 2 — ») : Méthode 1 — division euclidienne de P(x) par (x − x₀), une étape par terme du quotient, reste nul ; Méthode 2 — identification : poser Q(x) = αx² + βx + γ, développer (x − x₀)(αx² + βx + γ), écrire le système de 4 équations (dans le champ latex : \\left\\{ \\begin{array}{l} … \\end{array} \\right.) et le résoudre (α, puis β, puis γ, vérification).",
      eq3_solveq:
        "Méthode attendue : résoudre Q(x) = 0 (second degré) avec le discriminant Δ, puis conclure sur l'ensemble des solutions de P(x) = 0 : x₀ et les solutions de Q(x) = 0.",
      eq3_solve:
        "Méthode attendue, en trois parties : 1) racine évidente x₀ (calcul de P(x₀) = 0) ; 2) factorisation P(x) = (x − x₀)·Q(x) (division euclidienne ou identification des coefficients) ; 3) résolution de Q(x) = 0 avec Δ, puis ensemble des solutions S et forme factorisée de P(x).",
    };
    const userMsg =
      `Équation : ${input}\n` +
      `Résultats corrects déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `${methods[operation] || ""}\n` +
      `Sois concis et pédagogique : 5 à 10 étapes, 2 à 3 phrases par étape, un calcul clé dans le champ latex. Les solutions sont réelles (on travaille dans ℝ). ` +
      `Aboutis EXACTEMENT aux valeurs fournies (forme exacte : fractions, racines carrées) ; n'invente aucune autre valeur.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Piecewise-defined functions: continuity / differentiability at the junction points, parameters.
  if (operation === "pw_study" || operation === "pw_cont" || operation === "pw_deriv" || operation === "pw_params") {
    const focus = {
      pw_study: "la continuité ET la dérivabilité en chaque point de raccordement",
      pw_cont: "la continuité en chaque point de raccordement",
      pw_deriv: "la dérivabilité en chaque point de raccordement (en rappelant que dérivable implique continue)",
      pw_params: "la détermination des paramètres",
    }[operation];
    const userMsg =
      `Fonction définie par intervalles : ${input}\n` +
      `Objectif : étudier ${focus}.\n` +
      `Résultats corrects déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau Terminale, une idée par étape, en traitant chaque point de raccordement x₀ séparément :\n` +
      `- Continuité en x₀ : calcule f(x₀) avec la bonne expression (celle de l'intervalle qui contient x₀, ou la valeur donnée), puis la limite à gauche avec l'expression de l'intervalle de gauche et la limite à droite avec celle de l'intervalle de droite. Emploie le mot « intervalle », jamais « morceau ». f est continue en x₀ si et seulement si ces deux limites existent et sont égales à f(x₀). Pour une forme indéterminée 0/0, montre la factorisation ou la simplification.\n` +
      `- Dérivabilité en x₀ : si f n'est pas continue en x₀, elle n'y est pas dérivable. Sinon, calcule la limite à gauche et à droite du taux d'accroissement (f(x) − f(x₀))/(x − x₀) : ce sont les nombres dérivés à gauche f'g(x₀) et à droite f'd(x₀). Égaux et finis : f est dérivable, donne f'(x₀) et l'équation de la tangente y = f'(x₀)(x − x₀) + f(x₀). Différents : point anguleux, donne les deux demi-tangentes. Infini : demi-tangente verticale.\n` +
      `- Paramètres (s'il y en a) : traduis chaque condition (continuité : limite à gauche = limite à droite = f(x₀) ; dérivabilité : nombre dérivé à gauche = nombre dérivé à droite) en une équation, écris le SYSTÈME d'équations (dans le champ latex, utilise \\left\\{ \\begin{array}{l} … \\end{array} \\right.) et résous-le.\n` +
      `Sois concis : 6 à 10 étapes au total, 2 à 3 phrases d'explication par étape, un seul calcul clé dans le champ latex.\n` +
      `Aboutis EXACTEMENT aux valeurs fournies ; n'invente aucune autre valeur.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }
  if (operation === "diff_eq") {
    const userMsg =
      `Équation différentielle : ${input}\n` +
      `Solution correcte (fournie — à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau Terminale : pour y' = a y + b (a ≠ 0), la solution générale est y(x) = C·e^{a x} − b/a (la fonction constante −b/a est une solution particulière) ; ` +
      `pour y'' + ω² y = 0, la solution générale est y(x) = A·cos(ω x) + B·sin(ω x). Détermine la (les) constante(s) à partir de la (des) condition(s) initiale(s) fournie(s) et aboutis EXACTEMENT à la solution fournie.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // One-variable statistics.
  if (operation === "stats_series") {
    const userMsg =
      `Série statistique : ${input}\n` +
      `Paramètres déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau lycée : la moyenne x̄ = (Σ nᵢxᵢ)/N, la variance V = (Σ nᵢxᵢ²)/N − x̄² et l'écart-type σ = √V (mesure de dispersion autour de la moyenne) ; ` +
      `la médiane et les quartiles Q₁, Q₃ (Q₃ − Q₁ = écart interquartile) qui partagent la série ordonnée. Reste cohérent avec les valeurs fournies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Two-variable linear regression (least squares).
  if (operation === "stats_regression") {
    const userMsg =
      `Série double (x, y) : ${input}\n` +
      `Résultats déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau lycée : la droite d'ajustement affine y = ax + b obtenue par la méthode des moindres carrés, ` +
      `avec a = Cov(x,y)/V(x) et b = ȳ − a·x̄ ; le coefficient de corrélation linéaire r = Cov(x,y)/(σₓσᵧ) et ce qu'il indique sur la qualité de l'ajustement (proche de ±1 = forte corrélation). Reste cohérent avec les valeurs fournies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Binomial law.
  if (operation === "binomial_law") {
    const userMsg =
      `Loi binomiale : la variable aléatoire X suit la loi B(n, p) avec ${input}.\n` +
      `Résultats déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau Terminale : X compte le nombre de succès en n épreuves de Bernoulli indépendantes de probabilité p. ` +
      `Rappelle et applique P(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}, détaille les probabilités cumulées fournies (P(X≤k), P(X≥k) = 1 − P(X≤k−1)), ` +
      `et l'espérance E(X) = np et l'écart-type σ(X) = √(np(1−p)). Reste cohérent avec les valeurs fournies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Conditional probability (tree / Bayes).
  if (operation === "conditional_prob") {
    const userMsg =
      `Probabilités conditionnelles : ${input}.\n` +
      `Résultats déjà calculés (à expliquer, ne pas modifier) :\n${casResult}\n\n` +
      `Explique, niveau Terminale, à l'aide d'un arbre pondéré : la formule des probabilités totales P(B) = P(A)·P(B|A) + P(Ā)·P(B|Ā), ` +
      `l'intersection P(A∩B) = P(A)·P(B|A), et la formule de Bayes P(A|B) = P(A∩B) / P(B). Reste cohérent avec les valeurs fournies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Numerical sequence study.
  if (operation === "suite_study") {
    const userMsg =
      `Suite numérique : ${input}\n` +
      `Résultats déjà calculés (à expliquer/justifier, ne pas modifier) :\n${casResult}\n\n` +
      `Rédige une étude de la suite, niveau Terminale, cohérente avec ces résultats : ` +
      `(1) les premiers termes ; (2) la nature (arithmétique de raison r, géométrique de raison q, ou ni l'une ni l'autre) avec justification ; ` +
      `(3) le sens de variation (croissante/décroissante) ; (4) la limite / convergence quand n → +∞ ; ` +
      `(5) si elle est arithmétique ou géométrique, la somme des premiers termes avec la formule adaptée. ` +
      `Dans 'finalAnswerLatex', donne une conclusion courte (nature + limite).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Tangent line at a point x0.
  if (operation === "tangent") {
    const x0 = (params && params.x0) || "x_0";
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : déterminer l'équation de la tangente à la courbe au point d'abscisse x₀ = ${x0}.\n` +
      `Équation correcte (fournie — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `Explique, niveau Terminale : la tangente en x₀ a pour équation y = f'(x₀)(x − x₀) + f(x₀). Donne d'abord f'(x), calcule f(${x0}) et f'(${x0}), puis remplace dans la formule et développe pour aboutir EXACTEMENT à l'équation fournie. Dans 'finalAnswerLatex', écris l'équation de la tangente.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Convexity / inflection points via f''.
  if (operation === "convexity") {
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : étudier la convexité de f et déterminer les points d'inflexion.\n` +
      `Résultats déjà calculés (à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `Explique, niveau Terminale : calcule la dérivée seconde f''(x), étudie son signe ; f est CONVEXE (courbe tournée vers le haut) là où f''(x) > 0, CONCAVE là où f''(x) < 0 ; un point d'inflexion est un point où f'' s'annule EN CHANGEANT de signe. Reste cohérent avec les intervalles et points fournis. Dans 'finalAnswerLatex', résume la convexité.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Domain of definition: explain which constraints restrict the domain.
  if (operation === "domain") {
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : déterminer le domaine de définition D_f.\n` +
      `Domaine correct (fourni — à expliquer, ne pas modifier) : D_f = ${casResult}\n\n` +
      `Explique, niveau Terminale, pourquoi : repère les conditions d'existence (un dénominateur doit être non nul ; une expression sous une racine carrée doit être ≥ 0 ; l'argument d'un ln ou log doit être > 0 ; etc.), pose et résous chaque condition, puis conclus avec ce domaine. Reste cohérent avec le domaine fourni. Dans 'finalAnswerLatex', écris D_f = ${casResult}.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Variation table: explain the method (f', sign study, monotony, extrema, limits).
  if (operation === "variations") {
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Opération : dresser le tableau de variation de f.\n` +
      `Données déjà calculées (à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `Explique, niveau Terminale, la démarche :\n` +
      `- calcule la dérivée f'(x) ;\n` +
      `- étudie le signe de f'(x) (résous f'(x) = 0 puis détermine son signe sur chaque intervalle) ;\n` +
      `- déduis-en les variations (f croissante là où f'(x) > 0, décroissante là où f'(x) < 0) et la nature des extrema (maximum/minimum) ;\n` +
      `- s'il y a une (ou des) asymptote(s) verticale(s) (valeur interdite), signale-la et donne les limites à gauche et à droite (±∞) de part et d'autre ;\n` +
      `- précise les limites de f aux bornes du domaine (et en ±∞).\n` +
      `Reste strictement cohérent avec les données fournies (mêmes points critiques, mêmes limites). Dans 'finalAnswerLatex', résume le sens de variation, par exemple : f \\text{ croissante sur } ]-\\infty;x_1], \\text{ décroissante sur } [x_1;x_2]\\ldots`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
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
      // Two-method answers (e.g. quotient: division posée + identification) exceed 2000 tokens;
      // a truncated reply is invalid JSON → "Explication indisponible".
      max_tokens: /^(pw_|eq3_|eq2_param|system|zf_|integral_ipp)/.test(String(operation || "")) ? 8192 : 4096, // long multi-part explanations
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refusal" };
    if (response.stop_reason === "max_tokens") {
      console.warn("[mathsLab] reply truncated at max_tokens:", operation);
      return { ok: false, reason: "truncated" };
    }

    const block = (response.content || []).find((b) => b.type === "text");
    if (!block || !block.text) return { ok: false, reason: "empty" };

    // Parse as-is first (valid JSON keeps real newlines etc.); only repair lone
    // LaTeX backslashes when the model produced invalid JSON — otherwise the repair
    // would escape a genuine "\n" into a literal backslash-n that KaTeX shows raw.
    let parsed;
    try {
      parsed = JSON.parse(block.text);
    } catch (e1) {
      try {
        parsed = JSON.parse(repairJsonBackslashes(block.text));
      } catch (e2) {
        return { ok: false, reason: "parse" };
      }
    }

    // Strip control chars (newlines/tabs the model sometimes adds) so KaTeX never shows a
    // raw "\n" and the cache-corruption guard (charCode < 32) doesn't reject valid entries.
    const clean = (s) => String(s == null ? "" : s).replace(/[\u0000-\u001F]/g, " ").trim();
    const steps = (Array.isArray(parsed.steps) ? parsed.steps : []).map((st) => ({
      title: clean(st && st.title),
      latex: clean(st && st.latex),
      explanation: clean(st && st.explanation),
    }));
    const finalAnswerLatex = clean(parsed.finalAnswerLatex) || casResult;
    const verified = normalize(finalAnswerLatex) === normalize(casResult);
    return { ok: true, steps, finalAnswerLatex, verified };
  } catch (err) {
    console.error("[mathsLab] Claude error:", err && err.message);
    return { ok: false, reason: "api_error" };
  }
}

module.exports = { explainSteps, MATHS_LAB_MODEL, OPERATIONS, COMPLEX_OPERATIONS, ARITH_LABELS, TRIG_OPERATIONS, getClient, repairJsonBackslashes };
