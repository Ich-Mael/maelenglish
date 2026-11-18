/**
 * MaelEnglish programme catalogue — the single source for the storefront
 * catalogue (`/`) and the programme pages (`/programmes/[slug]`).
 * Edit programmes here, not in the pages.
 *
 * `status`: 'open' → « S'inscrire » (WhatsApp message naming the programme),
 *           'soon' → « Bientôt » badge + « Être prévenu(e) ».
 * Durations: Essentials 8 weeks per level, job programmes 12 weeks; every
 * programme = 50 h of learning content (Essentials: per level).
 * `photo` = base name of /images/photos/<photo>-{720,1280}.webp (+ -1280.jpg);
 * `photoPos` = optional CSS object-position.
 * `icon` / `FORMAT[].icon` = lucide-react icon names (mapped in the UI).
 * A `Course` delivers a programme through `Course.program` (= a slug below).
 */

export const WHATSAPP_NUMBER = "22667323131";

export type ProgramIcon =
  | "MessagesSquare"
  | "Plane"
  | "Briefcase"
  | "HeartPulse"
  | "Cpu"
  | "Coins"
  | "Landmark"
  | "Construction"
  | "Truck"
  | "Dumbbell";

export type FormatIcon = "Timer" | "Users" | "Laptop" | "Award";

export type FormatItem = { icon: FormatIcon; label: string; text: string };

export type Phrase = { en: string; fr: string };

export type EssentialsDetails = {
  levels: { badge: string; title: string; text: string; tags: string[] }[];
  structure: string[];
  pricing: string[];
  formatNote: string;
  /** Calendar is hidden while `sessions` / `schedule` are empty. */
  calendarYear: number;
  sessions: { label: string; start: string; end: string }[];
  seats: number;
  schedule: { day: string; time: string }[];
};

export type Program = {
  slug: string;
  name: string;
  tagline: string;
  icon: ProgramIcon;
  duration: string;
  hours: string;
  photo: string;
  photoPos?: string;
  status: "open" | "soon";
  featured?: boolean;
  level: string;
  audience: string;
  summary: string;
  objectives: string[];
  situations: string[];
  vocabulary: string[];
  phrases: Phrase[];
  details?: EssentialsDetails;
};

/** Shared format of the programmes (the first item takes each programme's duration — see `formatFor`). */
export const FORMAT: readonly FormatItem[] = [
  { icon: "Timer", label: "12 semaines", text: "50 h de contenu d’apprentissage, à suivre en parallèle de votre activité." },
  { icon: "Users", label: "Coach dédié", text: "Des devoirs et des prises de parole corrigés par un coach." },
  { icon: "Laptop", label: "100 % en ligne", text: "Sur notre plateforme e-learning, depuis votre ordinateur ou votre téléphone, où que vous soyez." },
  { icon: "Award", label: "Certificat", text: "Un certificat MaelEnglish à la fin du programme." },
];

export const PROGRAMS: readonly Program[] = [
  {
    slug: "essentials",
    name: "MaelEnglish Essentials",
    tagline: "L'anglais général en 8 semaines",
    icon: "MessagesSquare",
    duration: "8 semaines par niveau",
    hours: "50 h de contenu par niveau",
    photo: "essentials",
    status: "open",
    featured: true,
    level: "Débutant ou intermédiaire (test de niveau)",
    audience: "Toute personne qui veut poser des bases solides ou gagner en fluidité : étudiants, professionnels, entrepreneurs. C'est aussi le point de départ idéal avant un programme spécialisé.",
    summary: "Les fondamentaux de l'anglais pour parler avec aisance au quotidien : se présenter, échanger, comprendre et se faire comprendre.",
    objectives: [
      "Construire des phrases correctes et naturelles",
      "Tenir une conversation sur des sujets du quotidien",
      "Enrichir son vocabulaire et améliorer sa prononciation",
      "Gagner en confiance à l'oral comme à l'écrit",
    ],
    situations: ["Se présenter et parler de soi", "Échanger au téléphone", "Demander et donner des informations", "Raconter une expérience", "Écrire un message ou un e-mail simple"],
    vocabulary: ["Présentations", "Vie quotidienne", "Travail et études", "Voyages", "Temps et chiffres", "Opinions"],
    phrases: [
      { en: "Nice to meet you, I'm a student in Ouagadougou.", fr: "Enchanté, je suis étudiant à Ouagadougou." },
      { en: "Could you say that again, please?", fr: "Pourriez-vous répéter, s’il vous plaît ?" },
      { en: "I've been learning English for eight weeks.", fr: "J'apprends l'anglais depuis huit semaines." },
    ],
    details: {
      levels: [
        { badge: "Niveau 1", title: "Débutant", text: "Posez des bases solides : vous présenter, construire des phrases correctes et tenir des conversations simples de la vie quotidienne avec confiance.", tags: ["8 semaines", "50 h de contenu", "100 % pratique", "Fondamentaux"] },
        { badge: "Niveau 2", title: "Intermédiaire", text: "Gagnez en fluidité : enrichissez votre vocabulaire, améliorez votre prononciation et exprimez des idées plus complexes dans des contextes variés.", tags: ["8 semaines", "50 h de contenu", "Conversation", "Autonomie"] },
      ],
      structure: ["2 niveaux : Débutant et Intermédiaire", "Durée : 8 semaines par niveau", "Contenu : 50 h d’apprentissage par niveau", "Test de niveau obligatoire au début"],
      pricing: ["Frais de formation : 30 000 FCFA", "Possibilité de payer en 2 tranches", "Inscription : 5 000 FCFA (déductibles)"],
      formatNote: "100 % en ligne, sur notre plateforme e-learning : depuis votre ordinateur ou votre téléphone, où que vous soyez.",
      calendarYear: 2027,
      sessions: [],
      seats: 16,
      schedule: [],
    },
  },
  {
    slug: "aviation",
    name: "MaelEnglish for Aviation",
    tagline: "L'anglais de l'aéronautique et des aéroports",
    icon: "Plane",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "aviation",
    status: "open",
    level: "Intermédiaire conseillé",
    audience: "Personnel navigant, agents d’escale et de piste, techniciens de maintenance, personnel aéroportuaire et futurs professionnels de l’aviation.",
    summary: "Sécurité, passagers, opérations et maintenance : la communication claire et standardisée de l’aviation.",
    objectives: ["Communiquer avec les passagers en toute situation", "Appliquer les annonces et consignes de sécurité", "Échanger sur les opérations et la maintenance", "Gagner en clarté et en précision à l’oral"],
    situations: ["Embarquement et accueil", "Annonces à bord", "Gestion d’un retard ou d’une urgence", "Briefing d’équipage", "Rapport de maintenance"],
    vocabulary: ["Aéroport", "Sécurité", "Cabine", "Opérations", "Maintenance", "Météo"],
    phrases: [
      { en: "Please fasten your seatbelt and switch off your phone.", fr: "Veuillez attacher votre ceinture et éteindre votre téléphone." },
      { en: "Boarding will begin at gate 3 in ten minutes.", fr: "L'embarquement commencera porte 3 dans dix minutes." },
      { en: "We are experiencing a slight delay due to weather.", fr: "Nous avons un léger retard dû à la météo." },
    ],
  },
  {
    slug: "business",
    name: "MaelEnglish for Business",
    tagline: "L'anglais des affaires et de l'entreprise",
    icon: "Briefcase",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "business",
    status: "open",
    level: "Intermédiaire conseillé",
    audience: "Entrepreneurs, managers, commerciaux, assistants de direction et toute personne en contact avec des clients ou partenaires anglophones.",
    summary: "Réunions, présentations, négociations et e-mails : les situations clés de la vie en entreprise, en anglais.",
    objectives: ["Animer et participer à une réunion", "Présenter un projet ou des résultats", "Négocier et conclure un accord", "Rédiger des e-mails professionnels efficaces"],
    situations: ["Réunion d’équipe", "Pitch et présentation", "Négociation commerciale", "Appel avec un client", "E-mails et comptes rendus"],
    vocabulary: ["Réunions", "Ventes", "Marketing", "Négociation", "Gestion de projet", "Relation client"],
    phrases: [
      { en: "Let's go over the agenda for today's meeting.", fr: "Passons en revue l'ordre du jour de la réunion." },
      { en: "We could offer a 10% discount on larger orders.", fr: "Nous pourrions accorder 10 % de remise sur les grosses commandes." },
      { en: "I'll send you a follow-up email this afternoon.", fr: "Je vous envoie un e-mail de suivi cet après-midi." },
    ],
  },
  {
    slug: "health",
    name: "MaelEnglish for Health",
    tagline: "L'anglais médical et des soins",
    icon: "HeartPulse",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "health",
    status: "open",
    level: "Intermédiaire conseillé",
    audience: "Médecins, infirmiers, sages-femmes, pharmaciens, techniciens de laboratoire, agents de santé communautaire et étudiants en santé.",
    summary: "Consultation, soins, transmissions et documents médicaux : communiquer clairement avec patients et collègues en anglais.",
    objectives: ["Mener un entretien avec un patient", "Expliquer un diagnostic et un traitement", "Faire des transmissions précises entre collègues", "Lire protocoles, notices et articles médicaux"],
    situations: ["Accueil et anamnèse", "Examen clinique", "Explication d’un traitement", "Transmissions d’équipe", "Urgences"],
    vocabulary: ["Corps humain", "Symptômes", "Médicaments", "Examens", "Hygiène et sécurité", "Santé publique"],
    phrases: [
      { en: "Can you describe the pain? Where does it hurt?", fr: "Pouvez-vous décrire la douleur ? Où avez-vous mal ?" },
      { en: "Take one tablet twice a day after meals.", fr: "Prenez un comprimé deux fois par jour après les repas." },
      { en: "The patient's blood pressure is stable.", fr: "La tension du patient est stable." },
    ],
  },
  {
    slug: "tech",
    name: "MaelEnglish for Tech",
    tagline: "L'anglais du numérique et de l'informatique",
    icon: "Cpu",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "tech",
    status: "open",
    level: "Débutant à intermédiaire",
    audience: "Développeurs, administrateurs systèmes et réseaux, data analysts, chefs de projet IT, designers et étudiants en informatique.",
    summary: "Documentation, réunions d’équipe, support et entretiens : travailler avec aisance dans un environnement tech international.",
    objectives: ["Lire et rédiger de la documentation technique", "Participer à un daily stand-up ou une revue de code", "Expliquer un problème et sa solution", "Réussir un entretien technique en anglais"],
    situations: ["Daily stand-up", "Revue de code", "Support utilisateur", "Présentation d’une démo", "Entretien technique"],
    vocabulary: ["Développement", "Réseaux", "Données", "Cybersécurité", "Gestion de projet agile", "Cloud"],
    phrases: [
      { en: "I'll push the fix before the stand-up.", fr: "J'envoie le correctif avant la réunion du matin." },
      { en: "Could you review my pull request?", fr: "Peux-tu relire ma pull request ?" },
      { en: "The bug only happens in production.", fr: "Le bug ne se produit qu’en production." },
    ],
  },
  {
    slug: "finance",
    name: "MaelEnglish for Finance",
    tagline: "L'anglais de la finance et de la comptabilité",
    icon: "Coins",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "finance",
    status: "open",
    level: "Intermédiaire conseillé",
    audience: "Comptables, auditeurs, analystes, banquiers, contrôleurs de gestion et étudiants en finance.",
    summary: "États financiers, budgets, audit et marchés : présenter et discuter des chiffres en anglais avec assurance.",
    objectives: ["Présenter des états financiers et des résultats", "Commenter un budget et des écarts", "Échanger avec auditeurs et investisseurs", "Lire des rapports financiers en anglais"],
    situations: ["Présentation des résultats", "Revue budgétaire", "Mission d’audit", "Rendez-vous bancaire", "Rapport financier"],
    vocabulary: ["Comptabilité", "Budget", "Audit", "Banque", "Investissement", "Fiscalité"],
    phrases: [
      { en: "Revenue grew by 12% compared to last quarter.", fr: "Le chiffre d’affaires a progressé de 12 % par rapport au trimestre précédent." },
      { en: "We're slightly over budget on marketing.", fr: "Nous dépassons légèrement le budget marketing." },
      { en: "The audit found no material misstatement.", fr: "L'audit n'a relevé aucune anomalie significative." },
    ],
  },
  {
    slug: "lawyers",
    name: "MaelEnglish for Lawyers",
    tagline: "L'anglais juridique",
    icon: "Landmark",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "lawyers",
    photoPos: "center top",
    status: "open",
    level: "Intermédiaire conseillé",
    audience: "Avocats, juristes d’entreprise, notaires, magistrats et étudiants en droit confrontés à des contrats, clients ou procédures en anglais.",
    summary: "Contrats, conseil et argumentation : maîtriser la terminologie et le style du droit en anglais.",
    objectives: ["Comprendre et rédiger des clauses contractuelles", "Conseiller un client anglophone", "Argumenter avec précision", "Lire de la jurisprudence et des textes en anglais"],
    situations: ["Rendez-vous avec un client", "Négociation d’un contrat", "Rédaction de clauses", "Plaidoirie et argumentation", "Correspondance juridique"],
    vocabulary: ["Contrats", "Droit des affaires", "Procédure", "Litiges", "Conformité", "Propriété intellectuelle"],
    phrases: [
      { en: "This clause shall remain in force for two years.", fr: "Cette clause restera en vigueur pendant deux ans." },
      { en: "My client denies any breach of contract.", fr: "Mon client conteste toute rupture de contrat." },
      { en: "We would advise you to settle out of court.", fr: "Nous vous conseillons de régler l’affaire à l’amiable." },
    ],
  },
  {
    slug: "civil-engineering",
    name: "MaelEnglish for Civil Engineering",
    tagline: "L'anglais du BTP et des chantiers",
    icon: "Construction",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "civil-engineering",
    status: "open",
    level: "Intermédiaire conseillé",
    audience: "Ingénieurs, techniciens, conducteurs de travaux, architectes et étudiants en génie civil travaillant avec des partenaires ou documents en anglais.",
    summary: "Plans, chantiers, sécurité et rapports techniques : communiquer avec précision sur un projet de construction.",
    objectives: ["Lire et expliquer des plans et spécifications", "Coordonner une équipe sur chantier", "Rédiger des rapports d’avancement", "Échanger avec des bureaux d’études internationaux"],
    situations: ["Réunion de chantier", "Visite et inspection", "Consignes de sécurité", "Rapport d’avancement", "Appel d’offres"],
    vocabulary: ["Matériaux", "Structures", "Plans et dessins", "Sécurité", "Planning", "Contrats"],
    phrases: [
      { en: "The concrete needs 28 days to reach full strength.", fr: "Le béton a besoin de 28 jours pour atteindre sa pleine résistance." },
      { en: "Please wear your hard hat on site at all times.", fr: "Portez votre casque en permanence sur le chantier." },
      { en: "We're two weeks ahead of schedule on the foundations.", fr: "Nous avons deux semaines d’avance sur les fondations." },
    ],
  },
  {
    slug: "logistics",
    name: "MaelEnglish for Logistics",
    tagline: "L'anglais du transport et de la supply chain",
    icon: "Truck",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "logistics",
    status: "open",
    level: "Débutant à intermédiaire",
    audience: "Transitaires, agents de dédouanement, gestionnaires d’entrepôt, acheteurs et transporteurs travaillant à l’international.",
    summary: "Expéditions, douane, entrepôt et fournisseurs : suivre et coordonner une chaîne logistique en anglais.",
    objectives: ["Suivre une expédition et gérer un retard", "Comprendre les documents de transport et de douane", "Négocier avec fournisseurs et transporteurs", "Rédiger des messages clairs et précis"],
    situations: ["Suivi d’une livraison", "Dédouanement", "Gestion d’un litige", "Commande fournisseur", "Réunion de planification"],
    vocabulary: ["Transport et fret", "Douane", "Entreposage", "Incoterms", "Achats", "Délais"],
    phrases: [
      { en: "The container is held at customs pending inspection.", fr: "Le conteneur est bloqué en douane en attente d’inspection." },
      { en: "Can you confirm the delivery date?", fr: "Pouvez-vous confirmer la date de livraison ?" },
      { en: "The goods are shipped under FOB terms.", fr: "La marchandise est expédiée selon l’incoterm FOB." },
    ],
  },
  {
    slug: "fitness",
    name: "MaelEnglish for Fitness",
    tagline: "L'anglais du sport et du coaching",
    icon: "Dumbbell",
    duration: "12 semaines",
    hours: "50 h de contenu",
    photo: "fitness",
    status: "open",
    level: "Débutant à intermédiaire",
    audience: "Coachs sportifs, préparateurs physiques, professeurs de fitness et de yoga, gérants de salles qui accueillent une clientèle anglophone.",
    summary: "Guider une séance, corriger une posture et motiver : coacher en anglais avec des consignes claires.",
    objectives: ["Animer une séance en anglais", "Donner des consignes et corriger une posture", "Conseiller sur l’entraînement et la nutrition", "Accueillir et fidéliser des clients"],
    situations: ["Échauffement et séance collective", "Coaching individuel", "Bilan et objectifs du client", "Conseils nutrition", "Accueil en salle"],
    vocabulary: ["Corps et muscles", "Exercices", "Matériel", "Nutrition", "Motivation", "Santé et sécurité"],
    phrases: [
      { en: "Keep your back straight and breathe out as you lift.", fr: "Gardez le dos droit et expirez en soulevant." },
      { en: "Let's do three sets of twelve reps.", fr: "Faisons trois séries de douze répétitions." },
      { en: "Great job, just one more round!", fr: "Bravo, encore un tour !" },
    ],
  },
];

export const PROGRAM_SLUGS: readonly string[] = PROGRAMS.map((p) => p.slug);

export function findProgram(slug: string | null | undefined): Program | null {
  if (!slug) return null;
  return PROGRAMS.find((p) => p.slug === slug) ?? null;
}

/** The shared format, with the first item showing this programme's duration. */
export function formatFor(program: Program): FormatItem[] {
  const [first, ...rest] = FORMAT;
  return [{ ...first, label: program.duration }, ...rest];
}

/** Paths of a programme photo: responsive WebP sources + JPEG fallback. */
export function programPhoto(program: Pick<Program, "photo">) {
  const base = `/images/photos/${program.photo}`;
  return {
    small: `${base}-720.webp`,
    large: `${base}-1280.webp`,
    fallback: `${base}-1280.jpg`,
  };
}

/** WhatsApp link with a message naming the programme (enrol, or « prévenez-moi » when it's not open yet). */
export function whatsappLink(program?: Program | null): string {
  const msg = !program
    ? "Bonjour, je souhaite des informations sur les programmes MaelEnglish."
    : program.status === "soon"
      ? `Bonjour, je souhaite être prévenu(e) de l'ouverture de ${program.name}.`
      : `Bonjour, je souhaite m'inscrire à ${program.name}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
