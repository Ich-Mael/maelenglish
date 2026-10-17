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
  system_free: "la résolution du système d'équations (non linéaire)",
  inequation: "la résolution de l'inéquation",
  vecteurs: "la résolution de l'exercice sur les vecteurs",
  transfo: "l'étude de la transformation du plan",
  analytique: "l'exercice de géométrie analytique (droites et cercles)",
  espace: "l'exercice de géométrie dans l'espace",
  conique: "l'étude de la conique",
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
  divisibilite: "l'étude de divisibilité / des restes",
  affine: "l'étude de l'application affine",
  branches: "les asymptotes et branches infinies",
  solve: "la résolution de l'équation",
  factor: "la factorisation de l'expression",
  expand: "le développement de l'expression",
};

// Free (non-linear) systems: method imposed by the client (detected from the shape of the system).
const SYSTEM_FREE_METHODS = {
  ln: "regroupe d'abord les logarithmes (ln a + ln b = ln(ab), ln a − ln b = ln(a/b)), puis passe à l'exponentielle pour obtenir un système sans logarithme ; résous-le ensuite par somme-produit (X² − SX + P = 0) ou par substitution, et garde seulement les solutions qui respectent les conditions d'existence",
  exp: "pose X = e^x et Y = e^y (X > 0, Y > 0), résous le système en X et Y, puis reviens à x = ln X et y = ln Y",
  sumprod: "méthode somme-produit : avec S = x + y et P = xy, x et y sont les solutions de X² − SX + P = 0 ; résous cette équation avec le discriminant puis écris les couples",
  linear: "substitution : isole une inconnue dans l'équation du premier degré et remplace-la dans l'autre équation",
  product: "substitution : de l'équation xy = k, tire y = k/x (x ≠ 0), remplace y dans l'autre équation, multiplie par x² et pose X = x² pour obtenir une équation du second degré en X (équation bicarrée) ; garde X ≥ 0, déduis x = ±√X puis y = k/x",
  sym3: "x, y et z sont les racines du polynôme t³ − St² + Qt − P = 0 (S = x + y + z, Q = xy + yz + zx, P = xyz) ; cherche une racine évidente, factorise, puis écris tous les triplets (permutations)",
  linear3: "substitution : exprime deux inconnues en fonction de la troisième à l'aide des équations simples, puis remplace dans l'équation restante",
  generic: "substitution : exprime une inconnue en fonction des autres à partir de l'équation la plus simple, puis remplace dans les autres équations",
};

// Inequations: method imposed by the client (detected from the form of the inequation).
const INEQUATION_METHODS = {
  deg1: "inéquation du premier degré : regroupe les termes en x d'un côté et les constantes de l'autre, puis divise par le coefficient de x en CHANGEANT LE SENS de l'inégalité s'il est négatif",
  deg2: "signe du trinôme : ramène à ax² + bx + c ⋄ 0, calcule Δ et les racines ; le trinôme est du signe de a à l'extérieur des racines et du signe contraire entre elles (si Δ < 0 : signe de a partout)",
  product: "ramène à « … ⋄ 0 », factorise (racine évidente si besoin), puis fais un tableau de signes avec une ligne par facteur",
  quotient: "ramène à « … ⋄ 0 » sur un même dénominateur, donne les valeurs interdites (dénominateur nul), puis fais un tableau de signes avec une ligne par facteur du numérateur et du dénominateur (double barre aux valeurs interdites)",
  ln: "écris d'abord les conditions d'existence (argument du ln strictement positif), puis utilise la stricte croissance de ln et de exp (ln a < ln b ⇔ a < b pour a, b > 0 ; ln x < k ⇔ 0 < x < e^k), et intersecte avec le domaine",
  exp: "isole l'exponentielle puis utilise la stricte croissance de ln : e^u > k ⇔ u > ln k si k > 0 (si k ≤ 0, e^u > k est toujours vrai)",
  sqrt: "écris les conditions d'existence (expression sous la racine ≥ 0), puis étudie les cas selon le signe des membres avant d'élever au carré",
  generic: "ramène à h(x) ⋄ 0, détermine le domaine, les zéros de h, puis étudie le signe de h sur chaque intervalle",
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

  // Plane transformations z' = az + b (direct) or z' = a·conj(z) + b (indirect): a, b, nature, elements,
  // images of points / lines / circles all computed client-side.
  if (operation === "transfo") {
    const task = (params && params.method) || "recog";
    const how = {
      recog: "identifie a et b ; si a ≠ 1, cherche le point invariant ω = aω + b, donc ω = b/(1 − a) ; écris a = k·e^{iθ} (module = rapport, argument = angle) et conclus : a = 1 translation, a réel homothétie, |a| = 1 rotation, sinon similitude directe (composée de l'homothétie et de la rotation de même centre)",
      recog_ind: "identifie a et b dans z' = a·\\overline{z} + b (transformation indirecte). Si |a| = 1 : f∘f(z) = a·\\overline{a\\overline{z} + b} + b = a\\overline{a}\\,z + a\\overline{b} + b = z + a\\overline{b} + b (car \\overline{a\\overline{z}} = \\overline{a}\\,z et a\\overline{a} = |a|^2 = 1) — écris cette formule générale puis calcule seulement a\\overline{b} + b avec les valeurs de a et b (valeur fournie dans les résultats), sans redévelopper f(f(z)) terme à terme ; si a\\overline{b} + b = 0, f∘f = id et f est une réflexion : l'axe est l'ensemble des points invariants (pose z = x + iy dans z = a\\overline{z} + b) ; sinon f est une symétrie glissée de vecteur u = (a\\overline{b} + b)/2 et d'axe celui de la réflexion s(z) = a\\overline{z} + b − u. Si |a| ≠ 1 : similitude indirecte, centre ω solution de ω = a\\overline{ω} + b (conjugue puis substitue : ω = (b + a\\overline{b})/(1 − |a|²)), rapport |a|, axe passant par Ω et faisant l'angle arg(a)/2 avec l'axe des abscisses ; c'est la composée de la réflexion d'axe Δ et de l'homothétie de centre Ω et de rapport |a|",
      write: "traduis la transformation par z' − ω = k·e^{iθ}(z − ω) (homothétie : z' − ω = k(z − ω) ; translation : z' = z + u), calcule k·e^{iθ} sous forme algébrique, puis développe pour obtenir z' = az + b",
      write_ind: "réflexion d'axe Δ passant par P et de vecteur directeur w : z' − z_P = (w/\\overline{w})·\\overline{(z − z_P)} ; similitude indirecte de centre Ω, de rapport k et d'axe faisant l'angle α avec l'axe des abscisses : z' − ω = k·e^{2iα}·\\overline{(z − ω)} ; calcule le coefficient sous forme algébrique puis développe pour obtenir z' = a\\overline{z} + b, puis justifie la nature et les éléments",
      find: "écris le système aA + b = A', aB + b = B', soustrais les deux équations pour obtenir a = (A' − B')/(A − B), déduis b = A' − aA, puis reconnais la transformation (centre ω = b/(1 − a), rapport |a|, angle arg a)",
      find_ind: "écris z' = a\\overline{z} + b et le système a\\overline{z_A} + b = z_{A'}, a\\overline{z_B} + b = z_{B'} ; par soustraction a = (z_{A'} − z_{B'})/\\overline{(z_A − z_B)}, puis b = z_{A'} − a\\overline{z_A} ; reconnais ensuite la transformation indirecte (réflexion, symétrie glissée ou similitude indirecte)",
      compose: "calcule f₂∘f₁(z) = f₂(f₁(z)) : remplace z par f₁(z) dans l'écriture de f₂ (par \\overline{f_1(z)} si f₂ est indirecte, en utilisant \\overline{uv} = \\overline{u}\\,\\overline{v} et \\overline{\\overline{z}} = z), développe, puis reconnais la transformation obtenue (directe si f₁ et f₂ sont toutes deux directes ou toutes deux indirectes, indirecte sinon)",
    }[task] || "";
    const userMsg =
      `Transformation du plan complexe : ${input}\n` +
      `Résultats corrects (fournis — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE (Terminale) : ${how}.\n` +
      `Calcule les images des points demandés avec l'écriture complexe trouvée. ` +
      `S'il y a des images de droites ou de cercles : l'image d'une droite est la droite passant par les images de deux de ses points (donne son équation) ; l'image d'un cercle de centre I et de rayon r est le cercle de centre f(I) et de rayon |a|·r. ` +
      `Écris les nombres complexes sous forme algébrique x + iy, les angles en radians modulo 2π, le conjugué \\overline{z}. ` +
      `Conclus avec EXACTEMENT la nature et les éléments fournis. Dans 'finalAnswerLatex', écris l'écriture complexe et la nature de la transformation.`;
    return { system: SYSTEM_PROMPT_COMPLEX, userMsg };
  }

  // Vectors without coordinates: every answer is computed client-side by a formal (exact) engine.
  // Conics (Terminale): reduction and elements computed exactly client-side.
  if (operation === "conique") {
    const fde = params && params.method === "fde";
    const userMsg =
      `Conique (Terminale) : ${input}\n` +
      `Résultats corrects (fournis — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE : ` + (fde
        ? `M(x ; y) appartient à la conique ⇔ MF = e·d(M, (D)) ⇔ MF² = e²·d(M, (D))² ; écris MF² et d(M, (D))² = (ax + by + c)²/(a² + b²), développe pour obtenir l'équation fournie ; la nature vient de e (e < 1 ellipse, e = 1 parabole, e > 1 hyperbole) ; puis `
        : ``) +
      `regroupe les termes en x et en y, complète les carrés pour obtenir l'équation réduite ; ` +
      `ellipse x²/a² + y²/b² = 1 (a > b) : c² = a² − b², foyers (±c ; 0), sommets, e = c/a, directrices x = ±a²/c ; ` +
      `hyperbole x²/a² − y²/b² = 1 : c² = a² + b², foyers (±c ; 0), sommets (±a ; 0), e = c/a, directrices x = ±a²/c, asymptotes y = ±(b/a)x ; ` +
      `parabole y² = 2px : sommet O, foyer (p/2 ; 0), directrice x = −p/2, e = 1 ; transpose ces formules avec le centre ou le sommet trouvé (changement de repère X = x − x₀, Y = y − y₀) et selon l'axe focal ; ` +
      `tangente en un point M₀ de la conique : règle du dédoublement (x² → x x₀, y² → y y₀, x → (x + x₀)/2, y → (y + y₀)/2).\n` +
      `Écris les valeurs exactes (fractions, racines). Conclus avec EXACTEMENT la nature et les éléments fournis. Dans 'finalAnswerLatex', écris l'équation réduite et la nature avec les éléments principaux.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Space geometry (Terminale): every answer computed exactly client-side.
  if (operation === "espace") {
    const userMsg =
      `Exercice de géométrie dans l'espace (repère orthonormé (O ; i, j, k), niveau Terminale).\n` +
      `Données : ${input}\n` +
      `Résultats corrects (fournis — plans et droites puis réponse de chaque question, séparées par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE : produit vectoriel \\vec{u}\\wedge\\vec{v} = (y z' − z y' ; z x' − x z' ; x y' − y x'), orthogonal à \\vec{u} et \\vec{v}, nul ⇔ vecteurs colinéaires ; ` +
      `plan par trois points : \\vec{n} = \\overrightarrow{AB}\\wedge\\overrightarrow{AC} puis ax + by + cz + d = 0 avec un point ; plan par un point et une normale : \\overrightarrow{AM}\\cdot\\vec{n} = 0 ; ` +
      `droite : représentation paramétrique M = A + t\\vec{u} ; distance d'un point à un plan |ax₀ + by₀ + cz₀ + d|/√(a² + b² + c²) ; distance d'un point M à une droite (A, \\vec{u}) : ‖\\overrightarrow{AM}\\wedge\\vec{u}‖/‖\\vec{u}‖ ; ` +
      `deux plans : \\vec{n_1}\\wedge\\vec{n_2} nul ⇒ parallèles (confondus si un point commun), sinon sécants selon une droite dirigée par \\vec{n_1}\\wedge\\vec{n_2} ; ` +
      `droite et plan : \\vec{u}\\cdot\\vec{n} = 0 ⇒ parallèle (ou contenue), sinon on injecte la représentation paramétrique dans l'équation du plan ; ` +
      `deux droites : \\vec{u_1}\\wedge\\vec{u_2} nul ⇒ parallèles, sinon produit mixte \\overrightarrow{A_1A_2}\\cdot(\\vec{u_1}\\wedge\\vec{u_2}) : nul ⇒ sécantes, non nul ⇒ non coplanaires ; ` +
      `aire du triangle ABC = ½‖\\overrightarrow{AB}\\wedge\\overrightarrow{AC}‖ ; volume du tétraèdre ABCD = |(\\overrightarrow{AB}\\wedge\\overrightarrow{AC})\\cdot\\overrightarrow{AD}|/6 (= ⅓ × aire de base × hauteur).\n` +
      `Traite chaque question dans l'ordre, avec un titre d'étape « Question n : … », en détaillant les calculs avec les valeurs. Conclus chaque question avec EXACTEMENT le résultat fourni. ` +
      `Dans 'finalAnswerLatex', résume les résultats des questions, séparés par des points-virgules (n'écris jamais « || »).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Analytic geometry (lines and circles): every answer computed exactly client-side.
  if (operation === "analytique") {
    const userMsg =
      `Exercice de géométrie analytique (droites et cercles, repère orthonormé, niveau 2nde / 1ère).\n` +
      `Données : ${input}\n` +
      `Résultats corrects (fournis — équations des objets puis réponse de chaque question, séparées par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE : droite — M(x ; y) ∈ (d) ⇔ det(\\overrightarrow{AM}, \\vec{u}) = 0 (vecteur directeur) ou \\overrightarrow{AM}·\\vec{n} = 0 (vecteur normal), équation cartésienne ax + by + c = 0 puis réduite y = mx + p ; ` +
      `vecteur directeur (−b ; a), vecteur normal (a ; b) ; parallèles ⇔ det des vecteurs normaux nul, perpendiculaires ⇔ produit scalaire des vecteurs normaux nul ; intersection par résolution du système ; ` +
      `distance d'un point à une droite |ax₀ + by₀ + c|/√(a² + b²) ; cercle de centre Ω(a ; b) et de rayon r : (x − a)² + (y − b)² = r² ; équation développée → forme canonique en complétant les carrés ; ` +
      `position d'un point : comparer ΩM² et r² ; droite et cercle : comparer la distance du centre à la droite et r, puis substituer et résoudre l'équation du second degré (discriminant) ; ` +
      `deux cercles : comparer Ω₁Ω₂ à r₁ + r₂ et |r₁ − r₂|, points communs en soustrayant les équations ; tangente en A : droite passant par A de vecteur normal \\overrightarrow{ΩA}.\n` +
      `Traite chaque question dans l'ordre, avec un titre d'étape « Question n : … », en détaillant les calculs avec les valeurs. Conclus chaque question avec EXACTEMENT le résultat fourni. ` +
      `Dans 'finalAnswerLatex', résume les résultats des questions, séparés par des points-virgules (n'écris jamais « || »).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  if (operation === "vecteurs" && params && params.method === "repere") {
    const userMsg =
      `Exercice de géométrie analytique (vecteurs dans un repère orthonormé, niveau 2nde).\n` +
      `Données : ${input}\n` +
      `Résultats corrects (fournis — coordonnées des points construits puis réponse de chaque question, séparées par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE (formules de 2nde) : coordonnées d'un vecteur \\overrightarrow{AB}(x_B − x_A ; y_B − y_A) ; milieu ((x_A + x_B)/2 ; (y_A + y_B)/2) ; ` +
      `point défini par une relation vectorielle : on pose M(x ; y) et on identifie les coordonnées ; parallélogramme ABCD ⇔ \\overrightarrow{AB} = \\overrightarrow{DC} ; ` +
      `distance AB = √((x_B − x_A)² + (y_B − y_A)²) ; colinéarité et alignement par le déterminant det(u, v) = xy' − x'y = 0 ; orthogonalité par xx' + yy' = 0 ; ` +
      `nature d'un triangle par les longueurs et la réciproque du théorème de Pythagore ; nature d'un quadrilatère : parallélogramme, puis diagonales de même longueur (rectangle), côtés consécutifs égaux (losange), les deux (carré) ; ` +
      `équation de droite : M(x ; y) ∈ (AB) ⇔ det(\\overrightarrow{AM}, \\overrightarrow{AB}) = 0, équation cartésienne puis réduite ; intersection : résolution du système des deux équations.\n` +
      `Traite chaque question dans l'ordre, avec un titre d'étape « Question n : … », en détaillant les calculs avec les valeurs. Conclus chaque question avec EXACTEMENT le résultat fourni. ` +
      `Dans 'finalAnswerLatex', résume les résultats des questions, séparés par des points-virgules (n'écris jamais « || »).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  if (operation === "vecteurs") {
    const userMsg =
      `Exercice de géométrie vectorielle (sans repère, figure quelconque).\n` +
      `Données : ${input}\n` +
      `Résultats corrects (fournis — décompositions dans la base indiquée et réponse de chaque question, séparées par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE : relation de Chasles (XY = XA + AY), propriétés du milieu (si M est le milieu de [AB], AM = MB = 1/2 AB) et du centre de gravité, et calcul vectoriel ; AUCUNE coordonnée, aucun repère.\n` +
      `Traite chaque question dans l'ordre, avec un titre d'étape « Question n : … ». ` +
      `« Montrer que » : pars d'un membre et transforme-le avec Chasles jusqu'à l'autre (si le résultat fourni est FAUX, explique pourquoi l'égalité ne tient pas). ` +
      `« Exprimer … en fonction de … » : utilise Chasles pour faire apparaître les vecteurs demandés. « Construire » : décris la construction à la règle (reporter les vecteurs). ` +
      `« Longueur » : utilise ‖k·u‖ = |k|·‖u‖. Conclus chaque question avec EXACTEMENT le résultat fourni. Écris les vecteurs \\overrightarrow{AB}. ` +
      `Dans 'finalAnswerLatex', résume les résultats des questions, séparés par des points-virgules (n'écris jamais « || »).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Inequation: solution set, factorisation and critical values computed client-side (exact when rational).
  if (operation === "inequation") {
    const userMsg =
      `Inéquation : ${input}\n` +
      `Résultat correct (fourni — ensemble des solutions, factorisation et valeurs critiques — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      (params && INEQUATION_METHODS[params.method] ? `MÉTHODE IMPOSÉE (celle du cours, à suivre telle quelle) : ${INEQUATION_METHODS[params.method]}.\n` : "") +
      `Explique la résolution pas à pas, niveau lycée. Ne dessine pas de tableau de signes en LaTeX (il est déjà affiché) : décris le signe intervalle par intervalle. ` +
      `Attention aux crochets : borne incluse [ ou ] selon que l'inégalité est large ou stricte, toujours ouverte en une valeur interdite et en ±∞ (notation française ]a ; b[). ` +
      `Conclus avec EXACTEMENT l'ensemble des solutions fourni. Dans 'finalAnswerLatex', écris S = … en LaTeX (\\left] … \\right[ pour les crochets, \\cup pour les réunions).`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Free (non-linear) system: the solution set is computed client-side (numeric + exact snapping).
  if (operation === "system_free") {
    const userMsg =
      `Système d'équations : ${input}\n` +
      `(les équations sont séparées par « ; » ; inconnues x, y et éventuellement z)\n` +
      `Résultat correct (fourni — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      (params && SYSTEM_FREE_METHODS[params.method]
        ? `MÉTHODE IMPOSÉE (celle du cours, à suivre telle quelle) : ${SYSTEM_FREE_METHODS[params.method]}. N'introduis AUCUNE autre variable auxiliaire (pas de u = x + y, v = x − y, etc.) et ne change pas de méthode.\n`
        : "") +
      `Explique la résolution, niveau lycée, en choisissant la méthode adaptée :\n` +
      `- commence par les conditions d'existence (ln(a) exige a > 0, sqrt(a) exige a ≥ 0, un dénominateur doit être non nul) ;\n` +
      `- méthodes possibles : propriétés du logarithme (ln a + ln b = ln(ab), ln a − ln b = ln(a/b)) puis passage à l'exponentielle ; somme S et produit P connus ⇒ x et y sont les racines de X² − SX + P = 0 ; changement de variable (X = e^x, Y = e^y, ou X = x²) ; substitution (exprimer une inconnue en fonction de l'autre) ; combinaison linéaire ;\n` +
      `- résous pas à pas, puis élimine les solutions qui ne vérifient pas les conditions d'existence ;\n` +
      `- conclus avec EXACTEMENT l'ensemble des solutions fourni (même nombre de solutions, mêmes valeurs).\n` +
      `Dans 'finalAnswerLatex', écris l'ensemble des solutions S = \\{ … \\} avec des couples (ou triplets) notés (a ; b).`;
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
      `(1) domaine de définition et conditions d'existence ; (2) parité éventuelle ; (3) limites aux bornes, asymptotes verticales, horizontales, obliques et branches paraboliques, exactement comme fournies (en ±∞ : a = lim f(x)/x puis b = lim [f(x) − ax] ; position de la courbe par rapport à l'asymptote si elle est fournie) ; ` +
      `(4) dérivée f'(x) et étude de son signe ; (5) sens de variation et extrema ; (6) points caractéristiques (intersections avec les axes). ` +
      `Pour une forme indéterminée (0 × ∞, ∞/∞, ∞ − ∞), lève-la par un changement de variable (ex. X = 1/x : x·e^(1/x) = e^X / X) et les croissances comparées (e^X / X → +∞, X·e^(−X) → 0, ln(x)/x → 0) ; n'affirme jamais qu'un facteur « l'emporte » sans cette justification. Les limites aux bornes et aux valeurs interdites fournies sont exactes (une limite peut être finie d'un côté et infinie de l'autre). ` +
      `IMPORTANT : ne dessine PAS de tableau de variation (ni en LaTeX array/matrice, ni en ASCII) — il est déjà affiché à l'élève ; décris le sens de variation uniquement en toutes lettres (« f croît sur …, décroît sur … »). ` +
      `Reste strictement cohérent avec les valeurs fournies (mêmes limites, mêmes extrema, même domaine). Dans 'finalAnswerLatex', donne une brève conclusion en TEXTE (pas de tableau ni d'array) résumant le sens de variation.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Asymptotes and infinite branches of a function: everything computed client-side.
  if (operation === "branches") {
    const userMsg =
      `Fonction : f(x) = ${input}\n` +
      `Résultats corrects (fournis, séparés par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE (Terminale) : 1) asymptotes verticales : en chaque valeur interdite a, calcule les limites à gauche et à droite ; si l'une est infinie, la droite x = a est asymptote verticale (une limite peut être finie d'un côté). ` +
      `2) en −∞ et en +∞ : calcule lim f(x). Si elle est finie et vaut ℓ : asymptote horizontale y = ℓ. Si elle est infinie : calcule a = lim f(x)/x ; si a = ±∞ : branche parabolique de direction (Oy) ; si a = 0 : branche parabolique de direction (Ox) ; ` +
      `si a est un réel non nul : calcule b = lim [f(x) − ax] ; si b est réel : asymptote oblique y = ax + b ; si b est infini : branche parabolique de direction la droite y = ax (ce n'est PAS une asymptote : ne dis jamais « c'est-à-dire asymptote »). ` +
      `3) position relative : étudie le signe de f(x) − ℓ ou de f(x) − (ax + b) au voisinage de l'infini quand il est fourni. ` +
      `Lève les formes indéterminées par factorisation, quantité conjuguée, changement de variable (X = 1/x) ou croissances comparées, jamais en affirmant qu'un terme « l'emporte » sans justification. ` +
      `Conclus avec EXACTEMENT les résultats fournis. Dans 'finalAnswerLatex', liste les asymptotes et branches infinies.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Plane affine maps / isometries (Terminale C): matrix, invariant points and nature computed client-side.
  if (operation === "affine") {
    const m = params && params.method;
    const pre = m === "write"
      ? `ÉCRIRE f À PARTIR DE SES ÉLÉMENTS : pars de la définition géométrique (translation : MM' = u ; homothétie : ΩM' = kΩM ; rotation : x' − x₀ = cos θ (x − x₀) − sin θ (y − y₀), y' − y₀ = sin θ (x − x₀) + cos θ (y − y₀) ; similitude directe : idem multiplié par k ; réflexion : MM' colinéaire au vecteur normal de D et milieu de [MM'] sur D ; projection / symétrie oblique / affinité : H ∈ D avec MH colinéaire à w, puis HM' = k·HM, donc MM' = (1 − k)·MH ; symétrie glissée : réflexion puis translation de vecteur u dirigeant l'axe), aboutis à l'expression analytique fournie, PUIS vérifie-la par l'étude ci-dessous. `
      : m === "compose"
      ? `COMPOSÉE f₂ ∘ f₁ : rappelle la nature de f₁ et de f₂, substitue x' et y' de f₁ dans l'expression de f₂ (x'' = …, y'' = …) pour obtenir l'expression fournie, puis étudie la composée. `
      : "";
    const userMsg =
      `Exercice (Terminale C, isométries et applications affines du plan, repère orthonormé) : ${input}\n` +
      `Résultats corrects (fournis, séparés par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE : ${pre}Écriture matricielle M' = AM + B et det A (f bijective ⇔ det A ≠ 0) ; points invariants : résous le système f(M) = M ; ` +
      `isométrie ⇔ f conserve les distances ⇔ colonnes de A orthonormées (a² + c² = 1, b² + d² = 1, ab + cd = 0) ; déplacement si det A = 1 (translation si A = I, sinon rotation : cos θ = a, sin θ = c, centre = point invariant) ; ` +
      `antidéplacement si det A = −1 : f∘f(M) = M + AB + B ; réflexion si AB + B = 0 (axe = droite des points invariants), sinon symétrie glissée de vecteur u = (AB + B)/2 ; homothétie si A = kI (centre = point invariant) ; similitude si A = k × matrice d'isométrie ; ` +
      `si les points invariants forment une droite D : écris MM' = (αx + βy + γ)·w (direction Δ dirigée par w) et le rapport k par A·w = k·w (k = 0 projection sur D parallèlement à Δ, k = −1 symétrie par rapport à D parallèlement à Δ, sinon affinité de base D, de direction Δ et de rapport k). ` +
      `Les mots déplacement / antidéplacement et le critère AB + B ne s'appliquent QUE si f est une isométrie ; sinon ne les emploie pas. Écris les valeurs exactes (fractions, racines). Conclus avec EXACTEMENT la nature et les éléments fournis. Dans 'finalAnswerLatex', écris la nature et les éléments caractéristiques.`;
    return { system: SYSTEM_PROMPT_FUNCTION, userMsg };
  }

  // Divisibility / residues of E(n) (Terminale C): everything decided exactly client-side.
  if (operation === "divisibilite") {
    const m = params && params.method;
    const method = m === "div_base"
      ? `CONGRUENCES : réécris chaque puissance a^(pn+q) = a^q × (a^p)^n, réduis chaque base modulo d (B ≡ ρ [d] ⇒ B^n ≡ ρ^n [d]), factorise pour faire apparaître d × (entier) ≡ 0 [d]. ` +
        `Puis donne la SECONDE MÉTHODE PAR RÉCURRENCE fournie : initialisation E(n₀) multiple de d, hérédité E(n+1) = B × E(n) + d × (…) (utilise exactement la relation fournie).`
      : m === "div_false"
      ? `L'AFFIRMATION EST FAUSSE : ne la démontre surtout pas. Montre le contre-exemple fourni (calcul de E(n) et division euclidienne par d), puis, par disjonction des cas selon le reste de n modulo L (tableau des restes fourni), indique pour quels n E(n) est divisible par d.`
      : `DISJONCTION DES CAS selon le reste r de n modulo L : tout entier s'écrit n = Lq + r (0 ≤ r < L) ; si n ≡ r [d] alors n^k ≡ r^k [d] ; pour une puissance B^n, utilise B ≡ ρ [d] puis la période des restes de ρ^n (ρ^L ≡ 1 [d] ⇒ ρ^n = (ρ^L)^q × ρ^r ≡ ρ^r [d]) ; ` +
        `dresse le tableau des restes (avec les valeurs fournies) puis conclus` +
        (m === "rest" ? ` : les restes possibles sont exactement les valeurs obtenues.` : m === "which" ? ` : E(n) est divisible par d exactement pour les classes de reste 0.` : ` : tous les restes sont nuls donc d divise E(n) pour tout n.`);
    const userMsg =
      `Exercice d'arithmétique (Terminale C, divisibilité et congruences) : ${input}\n` +
      `Résultats corrects (fournis, séparés par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE : ${method}\n` +
      `Utilise la notation a ≡ b [d] (en LaTeX : a \\equiv b \\; [d]) ; n'utilise jamais \\bmod, \\pmod ni de commande inventée. Écris chaque cas sous la forme « si n ≡ r [L] alors … ≡ … [d] » avec les valeurs fournies. Fais les calculs de restes un par un, sans en sauter. ` +
      `Conclus avec EXACTEMENT la conclusion fournie. Dans 'finalAnswerLatex', recopie la conclusion en LaTeX fournie.`;
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
  if (operation === "diff_eq" && params && params.method === "lin2") {
    const userMsg =
      `Équation différentielle linéaire du second ordre à coefficients constants : ${input}\n` +
      `Résultats corrects (fournis, séparés par « || » — à expliquer, ne pas modifier) : ${casResult}\n\n` +
      `MÉTHODE IMPOSÉE (Terminale) : on cherche des solutions de la forme x ↦ e^{rx} : r doit vérifier l'équation caractéristique r² + ar + b = 0 ; calcule Δ = a² − 4b. ` +
      `Si Δ > 0 : deux racines réelles r₁, r₂ et y = C₁e^{r₁x} + C₂e^{r₂x}. Si Δ = 0 : racine double r₀ = −a/2 et y = (C₁x + C₂)e^{r₀x}. ` +
      `Si Δ < 0 : racines complexes α ± iβ (α = −a/2, β = √(−Δ)/2) et y = e^{αx}(C₁cos(βx) + C₂sin(βx)). ` +
      `Puis, si des conditions initiales sont fournies, calcule y' , écris le système en C₁ et C₂, résous-le et donne la solution particulière. ` +
      `Valeurs exactes. Aboutis EXACTEMENT aux résultats fournis. Dans 'finalAnswerLatex', écris la solution générale et, s'il y en a une, la solution particulière.`;
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
      max_tokens: /^(pw_|eq3_|eq2_param|system|zf_|integral_ipp|vecteurs|transfo|analytique|espace|conique|divisibilite|affine|branches|study|diff_eq)/.test(String(operation || "")) ? 8192 : 4096, // long multi-part explanations
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
    // A lone "\frac", "\times", "\text", "\right", "\beta" is still VALID JSON (\f \t \r \b escapes) and would
    // silently become control characters: when the raw text has such a lone escape followed by a letter,
    // repair first.
    const looksLatexEscaped = /(^|[^\\])\\[fbtr][a-z]/.test(block.text);
    let parsed;
    try {
      parsed = JSON.parse(looksLatexEscaped ? repairJsonBackslashes(block.text) : block.text);
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

module.exports = { explainSteps, SYSTEM_FREE_METHODS, INEQUATION_METHODS, MATHS_LAB_MODEL, OPERATIONS, COMPLEX_OPERATIONS, ARITH_LABELS, TRIG_OPERATIONS, getClient, repairJsonBackslashes };
