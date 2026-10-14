/**
 * Kalan Maths Lab — « Questions ouvertes ».
 *
 * The student gives a statement (énoncé) and the questions to answer (« démontrer que… »,
 * « comparer… », « en déduire… »). No CAS can anchor these, so Claude writes the solution —
 * but every computational claim it makes is returned in a machine-checkable form
 * ({ lhs, relation, rhs, variables }) and VERIFIED here numerically: constants are evaluated,
 * identities / inequalities with variables are sampled over the given domain. A failed claim
 * triggers one corrective retry; anything still failing is flagged to the student.
 *
 * Two levels of help: "hint" (method + first step only) and "full" (complete written solution).
 */
const { getClient, repairJsonBackslashes, MATHS_LAB_MODEL } = require("./mathsLab");

// ---------------------------------------------------------------- safe evaluator
// Calculator syntax: numbers, single-letter variables, + - * / ^, parentheses, implicit
// products (2x, 2(x+1), (a)(b), xy), functions sqrt abs ln log exp sin cos tan, constants pi e.
const FUNCS = {
  sqrt: (v) => (v < 0 ? NaN : Math.sqrt(v)),
  abs: Math.abs,
  ln: (v) => (v <= 0 ? NaN : Math.log(v)),
  log: (v) => (v <= 0 ? NaN : Math.log(v)),
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

function tokenize(src) {
  const s = String(src || "")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9a-zA-Z.]+)/g, "sqrt($1)")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/·/g, "*")
    .replace(/√/g, "sqrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/π/g, "pi");
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: "num", v: parseFloat(s.slice(i, j)) }); i = j; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const word = s.slice(i, j); i = j;
      if (FUNCS[word] || word === "pi" || word === "int" || word === "root") { out.push({ t: "name", v: word }); continue; }
      for (const ch of word) out.push({ t: "name", v: ch }); // "xy" → x·y
      continue;
    }
    if ("+-*/^(),".includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error("caractère invalide : " + c);
  }
  return out;
}

function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const startsFactor = (tk) => tk && (tk.t === "num" || tk.t === "name" || tk.t === "(");
  function expr() {
    let n = term();
    while (peek() && (peek().t === "+" || peek().t === "-")) { const op = next().t; n = { op, l: n, r: term() }; }
    return n;
  }
  function term() {
    let n = unary();
    for (;;) {
      const tk = peek();
      if (tk && (tk.t === "*" || tk.t === "/")) { next(); n = { op: tk.t, l: n, r: unary() }; }
      else if (startsFactor(tk)) n = { op: "*", l: n, r: unary() };
      else break;
    }
    return n;
  }
  function unary() {
    if (peek() && peek().t === "-") { next(); return { op: "neg", a: unary() }; }
    if (peek() && peek().t === "+") { next(); return unary(); }
    return power();
  }
  function power() {
    const b = atom();
    if (peek() && peek().t === "^") { next(); return { op: "^", l: b, r: unary() }; }
    return b;
  }
  function atom() {
    const tk = next();
    if (!tk) throw new Error("expression incomplète");
    if (tk.t === "num") return { op: "num", v: tk.v };
    if (tk.t === "(") { const e = expr(); if (!peek() || peek().t !== ")") throw new Error("parenthèse manquante"); next(); return e; }
    if (tk.t === "name") {
      if (tk.v === "int" || tk.v === "root") {
        if (!peek() || peek().t !== "(") throw new Error("parenthèse attendue après " + tk.v);
        next(); const args = [expr()];
        while (peek() && peek().t === ",") { next(); args.push(expr()); }
        if (!peek() || peek().t !== ")") throw new Error("parenthèse manquante"); next();
        if (tk.v === "int") { if (args.length !== 3) throw new Error("int(a, b, f) attend 3 arguments"); return { op: "int", a: args[0], b: args[1], f: args[2] }; }
        if (args.length !== 2) throw new Error("root(n, x) attend 2 arguments");
        return { op: "root", n: args[0], x: args[1] };
      }
      if (FUNCS[tk.v]) {
        if (!peek() || peek().t !== "(") throw new Error("parenthèse attendue après " + tk.v);
        next(); const a = expr(); if (!peek() || peek().t !== ")") throw new Error("parenthèse manquante"); next();
        return { op: "fn", name: tk.v, a };
      }
      if (tk.v === "pi") return { op: "num", v: Math.PI };
      if (tk.v === "e") return { op: "num", v: Math.E };
      return { op: "var", name: tk.v };
    }
    throw new Error("expression invalide");
  }
  const tree = expr();
  if (p < toks.length) throw new Error("expression invalide");
  return tree;
}

function evaluate(n, env) {
  switch (n.op) {
    case "num": return n.v;
    case "var": return Object.prototype.hasOwnProperty.call(env, n.name) ? env[n.name] : NaN;
    case "neg": return -evaluate(n.a, env);
    case "+": return evaluate(n.l, env) + evaluate(n.r, env);
    case "-": return evaluate(n.l, env) - evaluate(n.r, env);
    case "*": return evaluate(n.l, env) * evaluate(n.r, env);
    case "/": return evaluate(n.l, env) / evaluate(n.r, env);
    case "^": {
      const b = evaluate(n.l, env), e = evaluate(n.r, env);
      if (b < 0 && Math.abs(e - Math.round(e)) > 1e-12) return NaN;
      return Math.pow(b, e);
    }
    case "fn": return FUNCS[n.name](evaluate(n.a, env));
    case "root": {
      const k = evaluate(n.n, env), v = evaluate(n.x, env);
      if (!(k >= 1) || Math.abs(k - Math.round(k)) > 1e-12) return NaN;
      if (v < 0) return Math.round(k) % 2 === 1 ? -Math.pow(-v, 1 / k) : NaN;
      return Math.pow(v, 1 / k);
    }
    case "int": { // ∫_a^b f(x) dx, composite Simpson (x is bound)
      const a = evaluate(n.a, env), b = evaluate(n.b, env);
      if (!isFinite(a) || !isFinite(b)) return NaN;
      const N = 1000, h = (b - a) / N; let sum = 0;
      for (let i = 0; i <= N; i++) {
        const y = evaluate(n.f, Object.assign({}, env, { x: a + i * h }));
        if (!isFinite(y)) return NaN;
        sum += y * (i === 0 || i === N ? 1 : i % 2 ? 4 : 2);
      }
      return (sum * h) / 3;
    }
  }
  return NaN;
}

function freeVars(n, acc = new Set()) {
  if (!n) return acc;
  if (n.op === "var") acc.add(n.name);
  if (n.op === "int") {
    freeVars(n.a, acc); freeVars(n.b, acc);
    const inner = freeVars(n.f, new Set()); inner.delete("x"); inner.forEach((v) => acc.add(v));
    return acc;
  }
  if (n.op === "root") { freeVars(n.n, acc); freeVars(n.x, acc); return acc; }
  ["a", "l", "r"].forEach((k) => n[k] && freeVars(n[k], acc));
  return acc;
}

// ---------------------------------------------------------------- claim verification
const RELATIONS = ["=", "<", ">", "<=", ">=", "!="];
function holds(rel, a, b) {
  const tol = 1e-7 * (1 + Math.abs(a) + Math.abs(b));
  switch (rel) {
    case "=": return Math.abs(a - b) <= tol;
    case "!=": return Math.abs(a - b) > tol;
    case "<": return a < b - 1e-12;
    case ">": return a > b + 1e-12;
    case "<=": return a <= b + tol;
    case ">=": return a >= b - tol;
  }
  return false;
}
// Hypothesis such as "x <= y" or "x <= y and y < 3" (also "et", "&&", ";") → [{ L, rel, R }]
function parseCondition(src) {
  const text = String(src || "").trim();
  if (!text) return [];
  return text.split(/\s+(?:and|et)\s+|&&|;/i).map((part) => {
    const m = part.match(/^(.*?)(<=|>=|!=|≤|≥|≠|<|>|=)(.*)$/);
    if (!m) throw new Error("condition invalide : " + part);
    const rel = { "≤": "<=", "≥": ">=", "≠": "!=" }[m[2]] || m[2];
    return { L: parse(m[1]), rel, R: parse(m[3]) };
  });
}
// Deterministic pseudo-random sampler (reproducible verification).
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Returns { status: 'ok' | 'fail' | 'unchecked', detail } */
function checkClaim(claim) {
  try {
    if (!claim || !RELATIONS.includes(claim.relation)) return { status: "unchecked", detail: "relation inconnue" };
    const L = parse(claim.lhs), R = parse(claim.rhs);
    const conds = parseCondition(claim.condition);
    const declared = new Map((claim.variables || []).map((v) => [String(v.name || "").trim(), v]));
    const used = new Set([...freeVars(L), ...freeVars(R)]);
    conds.forEach((c) => { freeVars(c.L, used); freeVars(c.R, used); });
    for (const name of used) if (!declared.has(name)) return { status: "unchecked", detail: "variable " + name + " sans domaine" };
    if (used.size === 0) {
      const a = evaluate(L, {}), b = evaluate(R, {});
      if (!isFinite(a) || !isFinite(b)) return { status: "unchecked", detail: "valeur non définie" };
      return holds(claim.relation, a, b) ? { status: "ok" } : { status: "fail", detail: `${claim.lhs} ≈ ${+a.toFixed(6)} et ${claim.rhs} ≈ ${+b.toFixed(6)}` };
    }
    const vars = [...used].map((name) => {
      const v = declared.get(name);
      let lo = Number(v.min), hi = Number(v.max);
      if (!isFinite(lo)) lo = -10; if (!isFinite(hi)) hi = 10;
      if (hi < lo) [lo, hi] = [hi, lo];
      const m = (hi - lo) * 1e-6; // open interval: stay strictly inside
      return { name, lo: lo + m, hi: hi - m };
    });
    const rand = rng(12345);
    let valid = 0;
    for (let k = 0; k < 4000 && valid < 200; k++) {
      const env = {};
      vars.forEach((v) => { env[v.name] = v.lo + (v.hi - v.lo) * rand(); });
      if (!conds.every((c) => { const u = evaluate(c.L, env), w = evaluate(c.R, env); return isFinite(u) && isFinite(w) && holds(c.rel, u, w); })) continue;
      const a = evaluate(L, env), b = evaluate(R, env);
      if (!isFinite(a) || !isFinite(b)) continue;
      valid++;
      if (!holds(claim.relation, a, b)) {
        const at = vars.map((v) => `${v.name} = ${+env[v.name].toFixed(4)}`).join(", ");
        return { status: "fail", detail: `faux pour ${at} : ${+a.toFixed(6)} ${claim.relation} ${+b.toFixed(6)} n'est pas vrai` };
      }
    }
    if (valid < 30) return { status: "unchecked", detail: "domaine de définition trop restreint" };
    return { status: "ok" };
  } catch (e) {
    return { status: "unchecked", detail: e.message };
  }
}

// ---------------------------------------------------------------- Claude
const CLAIM = {
  type: "object",
  properties: {
    lhs: { type: "string" },
    relation: { type: "string", enum: RELATIONS },
    rhs: { type: "string" },
    condition: { type: "string" },
    variables: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, min: { type: "number" }, max: { type: "number" } },
        required: ["name", "min", "max"],
        additionalProperties: false,
      },
    },
  },
  required: ["lhs", "relation", "rhs", "condition", "variables"],
  additionalProperties: false,
};
const OPEN_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          method: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                latex: { type: "string" },
                explanation: { type: "string" },
                claims: { type: "array", items: CLAIM },
              },
              required: ["title", "latex", "explanation", "claims"],
              additionalProperties: false,
            },
          },
          conclusion: { type: "string" },
        },
        required: ["question", "method", "steps", "conclusion"],
        additionalProperties: false,
      },
    },
  },
  required: ["answers"],
  additionalProperties: false,
};

const SYSTEM_PROMPT_OPEN = [
  "Tu es un professeur de mathématiques de lycée au Burkina Faso : clair, rigoureux et pédagogue.",
  "On te donne l'ÉNONCÉ d'un exercice et la liste des QUESTIONS (à démontrer / à faire). Tu réponds en français, question par question, dans l'ordre.",
  "Règles impératives :",
  "- Raisonne juste : chaque égalité, inégalité ou calcul que tu écris doit être VRAI. Vérifie mentalement avant d'écrire.",
  "- Pour une question « En déduire… », utilise explicitement les résultats des questions précédentes.",
  "- Champ 'latex' : LaTeX SANS délimiteurs ($, \\[ \\]). Champ 'explanation' : texte en français, maths éventuellement entre $…$.",
  "- Intervalles en notation française (]0\\,;\\,1[), virgule décimale, valeurs exactes (fractions, radicaux) plutôt que décimales.",
  "- Niveau lycée uniquement (identités remarquables, factorisation, carrés, encadrements, raisonnement direct, contraposée…).",
  "VÉRIFICATION (très important) : pour chaque étape contenant une affirmation mathématique vérifiable (égalité, comparaison, signe, identité, inégalité), ajoute dans 'claims' une ou plusieurs affirmations :",
  "- 'lhs' et 'rhs' en SYNTAXE CALCULATRICE (pas LaTeX) : 2+sqrt(5), sqrt(9+4*sqrt(5)), (y-x)*(y^2+x*y+x^2), 1/a+1/b, (1-a)*(1-b). Fonctions autorisées : sqrt, abs, ln, exp, sin, cos, tan ; constantes pi et e ; puissances avec ^.",
  "- 'relation' parmi = < > <= >= !=.",
  "- 'variables' : chaque lettre utilisée avec son domaine [min, max] tiré de l'énoncé (ex. a dans ]0;1[ → min 0, max 1 ; un réel quelconque → min -10, max 10). Liste vide si l'affirmation ne contient que des nombres.",
  "- 'condition' : l'hypothèse sous laquelle l'affirmation est vraie, en syntaxe calculatrice (ex. 'x <= y' pour « si x ≤ y », plusieurs hypothèses séparées par ' and ') ; chaîne vide s'il n'y en a pas.",
  "- Exemples : {lhs:'(2+sqrt(5))^2', relation:'=', rhs:'9+4*sqrt(5)', condition:'', variables:[]} ; {lhs:'(1-a)*(1-b)', relation:'>', rhs:'0', condition:'', variables:[{name:'a',min:0,max:1},{name:'b',min:0,max:1}]} ; {lhs:'(y-x)*(y^2+x*y+x^2)', relation:'=', rhs:'y^3-x^3', condition:'', variables:[{name:'x',min:-10,max:10},{name:'y',min:-10,max:10}]} ; {lhs:'y^3-x^3', relation:'>=', rhs:'0', condition:'x <= y', variables:[{name:'x',min:-10,max:10},{name:'y',min:-10,max:10}]}.",
  "- N'ajoute une affirmation que si elle est VRAIE pour toutes les valeurs du domaine qui vérifient la condition.",
].join("\n");

const MODE_TEXT = {
  hint: "MODE « COUP DE POUCE » : ne donne PAS la solution. Pour chaque question : 'method' = l'idée de la méthode en une ou deux phrases ; 'steps' = UNE SEULE étape, la première, pour bien démarrer (titre « Pour démarrer ») ; 'conclusion' = chaîne vide. Termine l'explication de l'étape par une invitation à poursuivre (ex. « À vous de continuer : … »).",
  full: "MODE « SOLUTION RÉDIGÉE » : rédige la solution complète de chaque question, comme attendue sur une copie : 'method' = la méthode en une phrase ; 'steps' = 2 à 6 étapes ; 'conclusion' = la phrase de conclusion (réponse à la question).",
};

// ---------------------------------------------------------------- question types & anchors
// Types: 'calc' (Calculer), 'show' (Montrer que), 'compare' (Comparer A et B). Before calling Claude
// we compute what we can: the relation between A and B (numbers), the value of a numeric expression,
// and whether an identity to prove actually holds — these "anchors" go into the prompt.
const TYPE_LABEL = { calc: "CALCULER", show: "MONTRER QUE", compare: "COMPARER", sign: "DÉTERMINER LE SIGNE" };
const TYPE_TEXT = {
  calc: "Donne le résultat sous forme EXACTE et simplifiée (fraction, radical…), puis une valeur approchée si utile. Ajoute une claim finale « expression = résultat ».",
  show: "Ton raisonnement doit aboutir EXACTEMENT à l'énoncé à démontrer (sans le supposer vrai au départ). Ajoute une claim pour l'énoncé démontré (avec 'condition' s'il y a une hypothèse).",
  sign: "Conclus par une phrase claire : « … est strictement positif », « … est strictement négatif » ou « … est nul » ; si le signe dépend d'une variable, donne-le sur chaque intervalle (tableau de signes). Méthodes : factorisation et règle des signes, signe de chaque facteur sur le domaine de l'énoncé, comparaison à 0. Ajoute une claim finale (expression > 0, < 0…) avec les variables et leur domaine.",
  compare: "Conclus par une phrase qui écrit la relation AVEC LES NOMBRES EUX-MÊMES (ex. « Donc 2 + √5 = √(9 + 4√5) », jamais seulement « A = B »). Méthodes possibles : signe de la différence, comparaison des carrés (nombres positifs), quotient. Ajoute une claim pour la relation finale.",
};
function fmt(v) { return Number.isFinite(v) ? String(+v.toPrecision(10)) : "?"; }
function splitRelation(src) {
  const m = String(src || "").match(/^(.*?)(<=|>=|!=|≤|≥|≠|<|>|=)(.*)$/);
  if (!m) return null;
  return { lhs: m[1].trim(), rel: { "≤": "<=", "≥": ">=", "≠": "!=" }[m[2]] || m[2], rhs: m[3].trim() };
}
function constValue(src) {
  try { const t = parse(src); if (freeVars(t).size) return null; const v = evaluate(t, {}); return Number.isFinite(v) ? v : null; } catch (e) { return null; }
}
function computeAnchor(q) {
  try {
    if (q.type === "compare") {
      const a = constValue(q.a), b = constValue(q.b);
      if (a === null || b === null) return null;
      const tol = 1e-9 * (1 + Math.abs(a) + Math.abs(b));
      const relation = Math.abs(a - b) <= tol ? "=" : a < b ? "<" : ">";
      return { kind: "compare", relation, a: fmt(a), b: fmt(b) };
    }
    if (q.type === "sign") {
      const v = constValue(q.expr);
      if (v === null) return null; // depends on variables: the domain comes from the statement
      const sign = Math.abs(v) <= 1e-12 ? "=0" : v > 0 ? ">0" : "<0";
      return { kind: "sign", sign, value: fmt(v) };
    }
    if (q.type === "calc") {
      let expr = String(q.expr || "");
      const rel = splitRelation(expr); if (rel && rel.rel === "=") expr = rel.rhs || rel.lhs;
      const v = constValue(expr);
      return v === null ? null : { kind: "value", value: fmt(v) };
    }
    if (q.type === "show") {
      const rel = splitRelation(q.expr);
      if (!rel || /\b(si|alors)\b/i.test(q.expr)) return null;
      const vars = [...new Set([...freeVars(parse(rel.lhs)), ...freeVars(parse(rel.rhs))])];
      // inequalities over an unknown domain are only meaningful for constants
      if (rel.rel !== "=" && vars.length > 0) return null;
      const c = checkClaim({ lhs: rel.lhs, relation: rel.rel, rhs: rel.rhs, condition: "", variables: vars.map((name) => ({ name, min: -10, max: 10 })) });
      if (c.status === "unchecked") return null;
      return { kind: "target", status: c.status, detail: c.detail || "" };
    }
  } catch (e) { /* not parseable: no anchor */ }
  return null;
}
function anchorLine(an) {
  if (!an) return "";
  if (an.kind === "compare") return `Résultat VÉRIFIÉ par le calcul : A ${an.relation} B (A ≈ ${an.a}, B ≈ ${an.b}). Ta conclusion doit être exactement « A ${an.relation} B ».`;
  if (an.kind === "value") return `Valeur numérique VÉRIFIÉE par le calcul : ≈ ${an.value}. Ton résultat exact doit avoir cette valeur.`;
  if (an.kind === "sign") return `Signe VÉRIFIÉ par le calcul : l'expression vaut ≈ ${an.value}, elle est donc ${an.sign === ">0" ? "strictement positive" : an.sign === "<0" ? "strictement négative" : "nulle"}. Ta conclusion doit être exactement celle-ci (justifie-la sans calculatrice).`;
  if (an.kind === "target" && an.status === "ok") return "L'énoncé à démontrer a été vérifié numériquement : il est vrai.";
  if (an.kind === "target" && an.status === "fail") return `ATTENTION : l'énoncé à démontrer semble FAUX (${an.detail}). Ne le démontre pas : explique poliment pourquoi il est faux (contre-exemple) et propose la correction probable.`;
  return "";
}

function buildUserMsg(statement, questions, mode) {
  return [
    "ÉNONCÉ :",
    statement,
    "",
    "QUESTIONS :",
    ...questions.map((q, i) => {
      const head = `${i + 1}) [${TYPE_LABEL[q.type] || "QUESTION"}] ${q.text}`;
      const extra = [TYPE_TEXT[q.type] || "", anchorLine(q.anchor)].filter(Boolean).map((t) => "   → " + t);
      return [head, ...extra].join("\n");
    }),
    "",
    MODE_TEXT[mode],
    "Réponds avec exactement une entrée dans 'answers' par question, dans l'ordre ('question' = « 1) », « 2) », …).",
  ].join("\n");
}

function parseReply(response) {
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block || !block.text) return null;
  try { return JSON.parse(block.text); } catch (e1) {
    try { return JSON.parse(repairJsonBackslashes(block.text)); } catch (e2) { return null; }
  }
}
const clean = (s) => String(s == null ? "" : s).replace(/[\u0000-\u001F]/g, " ").trim();

function verifyAll(parsed) {
  const failures = [];
  let ok = 0, unchecked = 0;
  (parsed.answers || []).forEach((a, qi) => {
    (a.steps || []).forEach((st, si) => {
      st.checks = (st.claims || []).map((c) => {
        const r = checkClaim(c);
        if (r.status === "ok") ok++;
        else if (r.status === "fail") failures.push({ qi, si, claim: c, detail: r.detail });
        else unchecked++;
        return { lhs: clean(c.lhs), relation: c.relation, rhs: clean(c.rhs), condition: clean(c.condition), status: r.status, detail: r.detail || "" };
      });
      delete st.claims;
      st.title = clean(st.title); st.latex = clean(st.latex); st.explanation = clean(st.explanation);
    });
    a.question = clean(a.question); a.method = clean(a.method); a.conclusion = clean(a.conclusion);
  });
  return { ok, unchecked, failed: failures.length, failures };
}

/**
 * solveOpenQuestion({ statement, questions, mode }) → { ok, answers, verification, retried } | { ok:false, reason }
 */
async function solveOpenQuestion({ statement, questions, mode }) {
  const client = getClient();
  if (!client) return { ok: false, reason: "no_key" };
  // accept plain strings (legacy) or typed questions { type, text, expr, a, b }
  questions = questions.map((q) => (typeof q === "string" ? { type: "", text: q } : q));
  questions.forEach((q) => { q.anchor = computeAnchor(q); });
  const messages = [{ role: "user", content: buildUserMsg(statement, questions, mode) }];
  const call = (msgs) => client.messages.create({
    model: MATHS_LAB_MODEL,
    max_tokens: 8192,
    system: [{ type: "text", text: SYSTEM_PROMPT_OPEN, cache_control: { type: "ephemeral" } }],
    messages: msgs,
    output_config: { format: { type: "json_schema", schema: OPEN_SCHEMA } },
  });
  try {
    let response = await call(messages);
    if (response.stop_reason === "refusal") return { ok: false, reason: "refusal" };
    if (response.stop_reason === "max_tokens") { console.warn("[openQuestions] truncated"); return { ok: false, reason: "truncated" }; }
    let rawText = ((response.content || []).find((b) => b.type === "text") || {}).text || "";
    let parsed = parseReply(response);
    if (!parsed || !Array.isArray(parsed.answers)) return { ok: false, reason: "parse" };
    let verification = verifyAll(parsed), retried = false;

    // One corrective retry when a claim is numerically false.
    if (verification.failed > 0) {
      const fb = verification.failures.map((f) => `- Question ${f.qi + 1}, étape ${f.si + 1} : « ${f.claim.lhs} ${f.claim.relation} ${f.claim.rhs} » est FAUX (${f.detail}).`).join("\n");
      const retryMsgs = messages.concat([
        { role: "assistant", content: rawText },
        { role: "user", content: "La vérification numérique a détecté des erreurs :\n" + fb + "\nCorrige ta réponse (raisonnement et affirmations) et renvoie la réponse complète au même format." },
      ]);
      const r2 = await call(retryMsgs);
      const p2 = r2.stop_reason === "end_turn" || r2.stop_reason === "stop_sequence" ? parseReply(r2) : null;
      if (p2 && Array.isArray(p2.answers)) {
        const v2 = verifyAll(p2);
        if (v2.failed <= verification.failed) { parsed = p2; verification = v2; retried = true; }
      }
    }
    delete verification.failures;
    return { ok: true, answers: parsed.answers, verification, retried, anchors: questions.map((q) => q.anchor || null) };
  } catch (err) {
    console.error("[openQuestions] Claude error:", err && err.message);
    return { ok: false, reason: "api_error" };
  }
}

module.exports = { solveOpenQuestion, checkClaim, parse, evaluate, computeAnchor };
