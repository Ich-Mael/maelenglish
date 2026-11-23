/*
 * Learning-path diagnostic (owner spec ~/Desktop/DIAGNOSTIC_SPEC.md, 2026-11-23): the questionnaire,
 * section by section, with its conditional logic. Pure data shared by the browser (questionnaire)
 * and the server (labels sent to the AI, scoring). Values are the ids stored in the database.
 * French typography: a non-breaking space before « ? : ! ; » (`fr`).
 */

export type Answers = Record<string, string | string[] | number | undefined>;
export type Option = { value: string; label: string };
export type Question = {
  id: string;
  type: "single" | "multi" | "scale" | "text";
  label: string;
  options?: Option[];
  /** Adds « Autre (précisez) » with a text field (stored as `<id>_other`). */
  other?: boolean;
  max?: number;
  showIf?: (a: Answers) => boolean;
};
export type Section = { id: string; title: string; intro?: string; questions: Question[] };

/** Non-breaking space before French double punctuation. */
export const fr = (s: string) => s.replace(/ ([?:!;»])/g, " $1").replace(/« /g, "« ");

const o = (value: string, label: string): Option => ({ value, label: fr(label) });
const q = (x: Question): Question => ({ ...x, label: fr(x.label) });

const is = (a: Answers, id: string, ...values: string[]) => typeof a[id] === "string" && values.includes(a[id] as string);
const immersed = (a: Answers) => typeof a.q7 === "string" && a.q7 !== "no";

export const OTHER = "other";
export const OTHER_LABEL = "Autre (précisez)";

export const SCALE_LABELS = ["Pas du tout d'accord", "Plutôt pas d'accord", "Mitigé", "Plutôt d'accord", "Tout à fait d'accord"];

export const SECTIONS: Section[] = [
  {
    id: "school",
    title: "Le parcours scolaire",
    questions: [
      q({ id: "q1", type: "single", label: "À quel âge avez-vous commencé l'anglais ?", options: [o("primaire", "À l'école primaire"), o("college", "Au collège"), o("lycee", "Au lycée"), o("later", "Plus tard (études supérieures, travail)"), o("never_formal", "Je ne l'ai jamais vraiment étudié")] }),
      q({ id: "q2", type: "single", label: "Quel genre d'élève étiez-vous en anglais ?", options: [o("very_good", "Très bon"), o("ok", "Correct"), o("struggling", "En difficulté"), o("hated", "Je détestais ça")] }),
      q({ id: "q3", type: "multi", label: "En cours, vous faisiez surtout…", options: [o("grammar", "De la grammaire et des exercices écrits"), o("reading", "De la lecture de textes"), o("speaking", "De l'oral"), o("mix", "Un peu de tout")] }),
      q({ id: "q4", type: "single", label: "Combien de fois avez-vous vraiment parlé anglais en classe ?", options: [o("often", "Souvent"), o("sometimes", "Parfois"), o("almost_never", "Presque jamais")] }),
      q({ id: "q5a", type: "single", label: "Aujourd'hui, comment vivez-vous l'écart entre vos notes de l'époque et votre aisance actuelle ?", options: [o("no_thought", "Je n'y pense pas"), o("bit_frustrating", "C'est un peu frustrant"), o("awkward", "C'est gênant, je devrais savoir parler"), o("ashamed", "J'en ai un peu honte")], showIf: (a) => is(a, "q2", "very_good", "ok") }),
      q({ id: "q6a", type: "multi", other: true, label: "Qu'est-ce qui vous rendait bon en anglais à l'école ?", options: [o("learned_lessons", "J'apprenais bien mes leçons et la grammaire"), o("loved_language", "J'aimais la langue (musique, films, séries)"), o("good_teacher", "J'avais un bon professeur"), o("good_writing", "J'avais de la facilité à l'écrit"), o("grades_only", "Je voulais de bonnes notes, sans plus")], showIf: (a) => is(a, "q2", "very_good", "ok") }),
      q({ id: "q5b", type: "single", other: true, label: "Qu'est-ce qui rendait l'anglais difficile pour vous ?", options: [o("grammar", "La grammaire"), o("teacher", "Le professeur"), o("fear_asked", "La peur d'être interrogé"), o("no_interest", "Pas d'intérêt pour la matière"), o("pace", "Le rythme trop rapide")], showIf: (a) => is(a, "q2", "struggling", "hated") }),
      q({ id: "q6b", type: "single", other: true, label: "Y a-t-il un souvenir de cours d'anglais qui vous a marqué ?", options: [o("mocked", "On s'est moqué de moi quand j'ai parlé"), o("humiliated", "Un professeur m'a découragé ou humilié"), o("lost", "Je ne comprenais rien et j'ai décroché"), o("fear_board", "J'avais peur d'être interrogé au tableau"), o("none", "Pas de souvenir particulier, je n'accrochais pas")], showIf: (a) => is(a, "q2", "struggling", "hated") }),
    ],
  },
  {
    id: "immersion",
    title: "L'immersion",
    questions: [
      q({ id: "q7", type: "single", label: "Avez-vous déjà séjourné dans un pays anglophone pour apprendre ou pratiquer l'anglais ?", options: [o("no", "Non"), o("lt_1m", "Oui, moins d'un mois"), o("1_3m", "Oui, 1 à 3 mois"), o("gt_3m", "Oui, plus de 3 mois")] }),
      q({ id: "q8", type: "single", other: true, label: "Dans quel cadre ?", options: [o("language_center", "Centre de langue (ex. Ghana)"), o("internship", "Stage"), o("work", "Travail"), o("family", "Famille / séjour personnel")], showIf: immersed }),
      q({ id: "q8_country", type: "single", other: true, label: "Dans quel pays ?", options: [o("ghana", "Ghana"), o("nigeria", "Nigeria"), o("uk", "Royaume-Uni"), o("usa_canada", "États-Unis / Canada")], showIf: immersed }),
      q({ id: "q9", type: "single", label: "À la fin du séjour, comment vous sentiez-vous en anglais ?", options: [o("much_better", "Beaucoup plus à l'aise"), o("bit_better", "Un peu mieux"), o("no_diff", "Pas de vraie différence")], showIf: immersed }),
      q({ id: "q10", type: "single", label: "Pendant le séjour, vous parliez anglais…", options: [o("all_time", "Presque tout le temps"), o("class_only", "Surtout en cours"), o("francophone_bubble", "On restait souvent entre francophones")], showIf: immersed }),
      q({ id: "q11", type: "single", label: "Depuis votre retour, votre niveau a…", options: [o("improved", "Progressé"), o("stagnated", "Stagné"), o("dropped", "Baissé"), o("dropped_lot", "Beaucoup baissé")], showIf: immersed }),
      q({ id: "q12", type: "multi", other: true, label: "Qu'avez-vous ressenti en réalisant que vous perdiez votre anglais après le retour ?", options: [o("frustration", "De la frustration : j'avais fait tant d'efforts"), o("wasted", "Le sentiment d'avoir perdu du temps ou de l'argent"), o("shame", "De la honte vis-à-vis de mon entourage"), o("nostalgia", "De la nostalgie : j'aimerais retrouver ce niveau"), o("not_noticed", "Je ne m'en suis pas vraiment rendu compte")], showIf: (a) => immersed(a) && is(a, "q11", "stagnated", "dropped", "dropped_lot") }),
    ],
  },
  {
    id: "attempts",
    title: "Après l'école : les tentatives",
    questions: [
      q({ id: "q13", type: "single", label: "Depuis la fin de vos études, avez-vous essayé de reprendre l'anglais ?", options: [o("no", "Non"), o("once", "Oui, une fois"), o("several", "Oui, plusieurs fois")] }),
      q({ id: "q14", type: "multi", other: true, label: "Avec quoi ?", options: [o("apps", "Applications (Duolingo, etc.)"), o("center", "Cours en centre de langue"), o("private", "Cours particuliers"), o("youtube", "YouTube / podcasts"), o("series", "Films et séries"), o("books", "Livres / manuels")], showIf: (a) => is(a, "q13", "once", "several") }),
      q({ id: "q15", type: "single", label: "Combien de temps avez-vous tenu, en général ?", options: [o("lt_1m", "Moins d'un mois"), o("1_3m", "1 à 3 mois"), o("gt_3m", "Plus de 3 mois")], showIf: (a) => is(a, "q13", "once", "several") }),
      q({ id: "q16", type: "multi", other: true, label: "Pourquoi avez-vous arrêté ?", options: [o("time", "Manque de temps"), o("no_progress", "Pas de progrès visibles"), o("too_academic", "Trop scolaire / ennuyeux"), o("cost", "Le coût"), o("discouraged", "Découragement")], showIf: (a) => is(a, "q13", "once", "several") }),
    ],
  },
  {
    id: "feelings",
    title: "Ce que vous ressentez aujourd'hui",
    intro: "Pour chaque phrase, dites si vous êtes d'accord (1 = pas du tout, 5 = tout à fait).",
    questions: [
      q({ id: "s17", type: "scale", label: "Je comprends souvent, mais je n'arrive pas à répondre." }),
      q({ id: "s18", type: "scale", label: "J'ai peur qu'on remarque mes fautes ou mon accent." }),
      q({ id: "s19", type: "scale", label: "Avec mon parcours, je devrais déjà bien parler anglais." }),
      q({ id: "s20", type: "scale", label: "L'anglais, ce n'est pas vraiment pour moi." }),
      q({ id: "s21", type: "scale", label: "Je me sens en retard par rapport à mes collègues." }),
      q({ id: "s22", type: "scale", label: "J'ai déjà investi du temps ou de l'argent sans vrai résultat." }),
      q({ id: "s23", type: "scale", label: "Quand un anglophone parle vite, je décroche." }),
      q({ id: "s24", type: "scale", label: "Je préfère éviter les situations où je dois parler anglais." }),
      q({ id: "q25", type: "single", other: true, label: "Pensez à un moment récent où vous auriez voulu mieux parler anglais. C'était…", options: [o("meeting", "En réunion ou visioconférence"), o("phone", "Au téléphone avec un partenaire"), o("writing", "En rédigeant un email ou un rapport"), o("interview", "En entretien ou en recrutement"), o("travel", "En voyage ou en mission"), o("informal", "Avec des collègues anglophones, de manière informelle")] }),
      q({ id: "q25b", type: "single", other: true, label: "Sur le moment, vous avez…", options: [o("let_other", "Laissé quelqu'un d'autre parler à ma place"), o("brief", "Répondu très brièvement pour éviter de parler"), o("spoke_uneasy", "Parlé, mais en me sentant mal à l'aise"), o("pretended", "Fait semblant de comprendre"), o("avoided", "Évité complètement la situation")] }),
      q({ id: "q25c", type: "multi", label: "Ce que vous avez ressenti :", options: [o("embarrassment", "Gêne"), o("frustration", "Frustration"), o("stress", "Stress"), o("shame", "Honte"), o("self_anger", "Colère contre moi-même"), o("indifference", "Indifférence")] }),
      q({ id: "q25d", type: "text", label: "Si vous le souhaitez, racontez ce moment en une ou deux phrases." }),
    ],
  },
  {
    id: "work",
    title: "Votre réalité professionnelle",
    questions: [
      q({ id: "q26", type: "multi", other: true, label: "Dans votre travail, l'anglais sert à…", options: [o("meetings", "Réunions"), o("emails", "Emails"), o("partners", "Partenaires / ONG / bailleurs"), o("tenders", "Appels d'offres / propositions"), o("trainings", "Formations / séminaires"), o("clients", "Clients")] }),
      q({ id: "q27", type: "single", label: "Travaillez-vous avec des anglophones (Ghana, Nigeria, international) ?", options: [o("often", "Souvent"), o("sometimes", "Parfois"), o("rarely", "Rarement")] }),
      q({ id: "q28", type: "single", label: "L'anglais a-t-il déjà freiné votre carrière ?", options: [o("yes", "Oui"), o("no", "Non"), o("unsure", "Je ne sais pas")] }),
      q({ id: "q29", type: "multi", other: true, label: "Comment ?", options: [o("didnt_apply", "Je n'ai pas postulé à une offre qui demandait l'anglais"), o("failed_interview", "J'ai échoué à un entretien ou à un test"), o("mission_given", "On a confié une mission ou un voyage à un collègue"), o("missed_training", "J'ai raté une formation ou une bourse à l'étranger"), o("blocked_promotion", "Je ne peux pas évoluer vers un poste international")], showIf: (a) => is(a, "q28", "yes") }),
    ],
  },
  {
    id: "projection",
    title: "La projection",
    questions: [
      q({ id: "q30", type: "multi", max: 3, other: true, label: "Dans 6 mois, qu'aimeriez-vous être capable de faire en anglais ? (jusqu'à 3 choix)", options: [o("meeting_no_stress", "Participer à une réunion sans stress"), o("present", "Présenter un projet ou un rapport"), o("write_emails", "Rédiger des emails professionnels sans aide"), o("job_interview", "Passer un entretien d'embauche en anglais"), o("negotiate", "Négocier ou échanger avec des partenaires"), o("tenders", "Répondre à des appels d'offres"), o("understand_fast", "Comprendre les anglophones qui parlent vite"), o("certification", "Obtenir une certification (TOEIC, IELTS…)"), o("travel_alone", "Voyager ou partir en mission sans dépendre de quelqu'un")] }),
      q({ id: "q31", type: "multi", other: true, label: "Comment vous sentiriez-vous ce jour-là ?", options: [o("proud", "Fier(e) de moi"), o("relieved", "Soulagé(e)"), o("confident", "Plus confiant(e) au travail"), o("legitimate", "Enfin légitime pour un poste à responsabilité"), o("free", "Libre de saisir des opportunités")] }),
      q({ id: "q32", type: "single", label: "Combien de temps pouvez-vous réellement consacrer à l'anglais par semaine ?", options: [o("lt_1h", "Moins d'1 heure"), o("1_2h", "1 à 2 heures"), o("2_4h", "2 à 4 heures"), o("gt_4h", "Plus de 4 heures"), o("varies", "Ça dépend des semaines")] }),
    ],
  },
];

export const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions);
export const QUESTION = Object.fromEntries(ALL_QUESTIONS.map((x) => [x.id, x])) as Record<string, Question>;

/** The questions shown for these answers (conditional logic), in order. */
export const visibleQuestions = (a: Answers) => ALL_QUESTIONS.filter((x) => !x.showIf || x.showIf(a));

/** Is a question answered? (open questions are optional, so they never block). */
export function isAnswered(x: Question, a: Answers): boolean {
  const v = a[x.id];
  if (x.type === "text") return true;
  if (x.type === "scale") return typeof v === "number" && v >= 1 && v <= 5;
  if (x.type === "multi") return Array.isArray(v) && v.length > 0 && (!v.includes(OTHER) || !!String(a[`${x.id}_other`] ?? "").trim());
  return typeof v === "string" && !!v && (v !== OTHER || !!String(a[`${x.id}_other`] ?? "").trim());
}

/**
 * Answers cleaned against the questionnaire (from the browser): only visible questions, known
 * values, `max` respected, « Autre » texts trimmed (300 chars), open text (600 chars).
 */
export function cleanAnswers(raw: unknown): Answers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Answers = {};
  // Two passes: conditions depend on earlier answers.
  for (let pass = 0; pass < 2; pass++) {
    for (const x of ALL_QUESTIONS) {
      if (x.showIf && !x.showIf(out)) {
        delete out[x.id];
        delete out[`${x.id}_other`];
        continue;
      }
      const v = r[x.id];
      const values = new Set([...(x.options ?? []).map((op) => op.value), ...(x.other ? [OTHER] : [])]);
      if (x.type === "scale") {
        const n = Math.round(Number(v));
        if (n >= 1 && n <= 5) out[x.id] = n;
      } else if (x.type === "text") {
        if (typeof v === "string" && v.trim()) out[x.id] = v.trim().slice(0, 600);
      } else if (x.type === "single") {
        if (typeof v === "string" && values.has(v)) out[x.id] = v;
      } else if (Array.isArray(v)) {
        const picked = [...new Set(v.filter((y): y is string => typeof y === "string" && values.has(y)))].slice(0, x.max ?? 20);
        if (picked.length) out[x.id] = picked;
      }
      const other = r[`${x.id}_other`];
      const chose = out[x.id] === OTHER || (Array.isArray(out[x.id]) && (out[x.id] as string[]).includes(OTHER));
      if (chose && typeof other === "string" && other.trim()) out[`${x.id}_other`] = other.trim().slice(0, 300);
    }
  }
  return out;
}

/** Answers with readable labels, for the AI (never the learner's contact details). */
export function answersInWords(a: Answers): string {
  const lines: string[] = [];
  for (const s of SECTIONS) {
    const shown = s.questions.filter((x) => (!x.showIf || x.showIf(a)) && a[x.id] !== undefined);
    if (!shown.length) continue;
    lines.push(`## ${s.title}`);
    for (const x of shown) {
      const v = a[x.id];
      const label = (val: string) => (val === OTHER ? `Autre : ${a[`${x.id}_other`] ?? ""}` : (x.options?.find((op) => op.value === val)?.label ?? val));
      const text = x.type === "scale" ? `${v}/5 (${SCALE_LABELS[Number(v) - 1]})` : Array.isArray(v) ? v.map(label).join(" ; ") : x.type === "text" ? `« ${v} »` : label(String(v));
      lines.push(`- [${x.id}] ${x.label.replace(/ /g, " ")} → ${text.replace(/ /g, " ")}`);
    }
  }
  return lines.join("\n");
}
