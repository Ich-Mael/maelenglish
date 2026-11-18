import { PROGRAMS } from "./catalog";

/* Editorial content of the public pages (from the original MaelEnglish storefront). */

export const METHOD_STEPS = [
  { title: "On fait le point", text: "Test de niveau, votre métier et vos objectifs : on vous oriente vers le bon programme." },
  { title: "Vous pratiquez", text: "Des situations réelles de votre quotidien professionnel, à l'oral comme à l'écrit." },
  { title: "Le coach corrige", text: "Des retours précis sur vos devoirs et vos prises de parole, pour progresser vite." },
  { title: "Vous êtes certifié", text: "Un certificat MaelEnglish à valoriser sur votre CV et votre profil professionnel." },
];

export const METHOD_FACTS = [
  "Programmes métiers : 12 semaines, 50 h de contenu",
  "MaelEnglish Essentials : 2 niveaux de 8 semaines, 80 h",
  "100 % en ligne",
  "Certificat à la fin",
];

/** Verifiable figures only (from the catalogue and the founder's own record). */
export const STATS = [
  { value: "40", suffix: "+", label: "Professionnels formés par Coach Ish" },
  { value: String(PROGRAMS.length), suffix: "", label: "Programmes, de l'anglais général aux métiers" },
  { value: "50", suffix: " h", label: "De contenu par programme métier" },
  { value: "100", suffix: " %", label: "En ligne, sur ordinateur ou téléphone" },
];

export const TESTIMONIALS = [
  { text: "Grâce au coaching MaelEnglish, j'ai pu décrocher un poste à l'international. La méthode est incroyablement efficace et pragmatique.", name: "Sarah K.", role: "Directrice Marketing · Coaching" },
  { text: "L'ambiance des cours en groupe est géniale. On apprend sans stress, et les progrès sont visibles dès les premières semaines.", name: "Mohamed D.", role: "Ingénieur logiciel · Cours en groupe" },
  { text: "J'avais peur de parler anglais, mais les coachs m'ont donné confiance. Aujourd'hui, je mène des réunions en anglais sans hésitation.", name: "Aminata T.", role: "Entrepreneure" },
  { text: "Une formation adaptée aux réalités du business. Mon anglais est maintenant un atout majeur pour mes négociations.", name: "Jean-Marc B.", role: "Commercial" },
];

export const COACHING = {
  audiences: [
    { icon: "Briefcase", title: "Cadres et managers", text: "Animer une réunion, présenter des résultats, piloter une équipe ou des partenaires anglophones." },
    { icon: "BadgeCheck", title: "Candidats", text: "Préparer un entretien en anglais, un CV et une lettre de motivation, une prise de poste à l’international." },
    { icon: "Building2", title: "Professions spécialisées", text: "Santé, finance, tech, juridique, ONG : le vocabulaire et les situations propres à votre secteur." },
    { icon: "Mic", title: "Prise de parole", text: "Conférences, pitchs, formations à animer : gagner en aisance et en clarté à l’oral." },
  ],
  steps: [
    { title: "Diagnostic", text: "Un premier échange pour évaluer votre niveau et comprendre votre métier et votre objectif." },
    { title: "Programme sur mesure", text: "Un plan de séances construit autour de vos situations réelles et de votre échéance." },
    { title: "Séances avec votre coach", text: "Mises en situation, corrections immédiates, exercices ciblés entre les séances." },
    { title: "Suivi et bilan", text: "Un point régulier sur vos progrès et un bilan final avec des recommandations." },
  ],
  phrases: [
    { role: "Entretien", en: "Tell me about a challenge you overcame.", fr: "Parlez-moi d’une difficulté que vous avez surmontée." },
    { role: "Présentation", en: "Let me walk you through our proposal.", fr: "Laissez-moi vous présenter notre proposition." },
    { role: "Négociation", en: "We could meet halfway on the price.", fr: "Nous pourrions trouver un compromis sur le prix." },
  ],
  faq: [
    { q: "Quel niveau faut-il pour commencer ?", a: "Aucun niveau minimum. Le diagnostic de départ sert justement à construire un programme adapté, du débutant qui veut oser parler au cadre qui veut perfectionner son anglais professionnel." },
    { q: "Les séances se font en ligne ?", a: "Oui, 100 % en ligne, en visioconférence : vous suivez votre coaching depuis votre ordinateur ou votre téléphone, où que vous soyez et selon votre emploi du temps." },
    { q: "Combien de temps dure un coaching ?", a: "Cela dépend de votre objectif et de votre échéance (un entretien dans deux semaines ou une progression sur plusieurs mois). Le rythme et la durée sont fixés ensemble après le diagnostic." },
    { q: "Quel est le tarif ?", a: "Le tarif dépend de la formule choisie (nombre et fréquence des séances). Écrivez-nous sur WhatsApp : un conseiller vous envoie une proposition adaptée." },
    { q: "Mon entreprise peut-elle prendre en charge le coaching ?", a: "Oui. Nous établissons un devis et un programme pour l’entreprise, pour un collaborateur ou pour une équipe." },
  ],
} as const;

/** The founder / lead coach — MaelEnglish is built around his personal brand (texts written by him). */
export const FOUNDER = {
  name: "Ismaël Zerbo",
  firstName: "Ismaël",
  /** What learners call him. */
  nickname: "Coach Ish",
  photo: "founder",
  title: "Fondateur de MaelEnglish · coach certifié TEFL",
  greeting: "mais mes apprenants m’appellent Coach Ish.",
  tagline: "J’aide les professionnels francophones à parler l’anglais de leur métier avec aisance, en réunion, en négociation et à l’écrit.",
  story: [
    "L’anglais fait partie de ma vie depuis l’enfance : nos vacances en famille au Ghana et au Nigeria m’ont plongé très tôt dans la langue, au quotidien. J’ai ensuite suivi une formation en Afrique du Sud, puis obtenu une certification TEFL (Teaching English as a Foreign Language) auprès d’un centre de formation accrédité aux États-Unis.",
    "À ce jour, j’ai formé plus de 40 professionnels issus d’ONG, du secteur minier et d’autres domaines. J’ai aussi préparé de nombreux jeunes à leurs entretiens d’admission et de visa pour étudier aux États-Unis, au Canada et ailleurs, et ils les ont réussis.",
    "J’ai créé MaelEnglish après avoir vu le même problème chez presque tous mes apprenants : des années de cours d’anglais, une bonne grammaire, mais un blocage au moment de prendre la parole devant un client, un partenaire ou un jury. Les méthodes classiques enseignent la langue, pas son usage au travail. Mon approche part donc de vos situations réelles (vos réunions, vos e-mails, vos présentations, vos entretiens) pour vous faire pratiquer l’anglais dont vous avez vraiment besoin, dès la première séance.",
  ],
  facts: [
    { value: "40+", label: "professionnels formés (ONG, secteur minier…)" },
    { value: "TEFL", label: "certification obtenue aux États-Unis" },
    { value: "Entretiens", label: "d’admission et de visa préparés et réussis (États-Unis, Canada…)" },
  ],
  quote: "L’anglais n’est pas une matière, c’est un outil de travail.",
} as const;

