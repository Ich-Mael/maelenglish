import type { ProfileId } from "./profiles";
import { PROFILE_INFO } from "./profiles";
import { fr } from "./questions";
import type { DiagnosticReport } from "./report-types";

/*
 * Ready-written report per profile (DIAGNOSTIC_SPEC.md §7), shown when the AI fails twice. The
 * first name and the 6-month goal are filled in; everything else is generic but true to the profile.
 */

type Base = Omit<DiagnosticReport, "goal_reminder" | "profile_name">;

const BASE: Record<ProfileId, (name: string) => Base> = {
  former_good_student: (n) => ({
    headline: `${n}, votre anglais est là : il attend juste de passer à l'oral.`,
    profile_summary: "Vous avez appris l'anglais sérieusement, avec de bonnes bases en grammaire et à l'écrit. Mais l'école vous a très peu fait parler, et aujourd'hui l'écart entre ce que vous savez et ce que vous osez dire vous pèse.",
    what_holds_you_back: [
      { title: "Peu d'oral à l'école", explanation: "Vos cours étaient centrés sur la grammaire et l'écrit. Vous n'avez jamais eu l'occasion d'automatiser la parole." },
      { title: "La pression du « je devrais savoir »", explanation: "Avec votre parcours, vous attendez beaucoup de vous-même. Cette exigence rend chaque hésitation plus lourde." },
    ],
    reframe: "Ce décalage n'est pas un manque de talent : c'est le résultat d'une méthode qui ne vous a pas fait parler. Vos bases sont un vrai capital, il faut maintenant les mettre en mouvement.",
    your_strengths: ["Une bonne base en grammaire et en vocabulaire", "L'habitude d'apprendre avec méthode", "Une bonne compréhension à l'écrit"],
    recommended_method: [
      { title: "Parler dès maintenant, même imparfaitement", description: "De courtes mises en situation orales chaque semaine, centrées sur votre travail, pour transformer vos connaissances en réflexes." },
      { title: "Des victoires rapides", description: "Préparez quelques phrases clés pour vos réunions et vos appels, et utilisez-les réellement : chaque réussite renforce la confiance." },
      { title: "Un retour bienveillant sur votre oral", description: "Faites-vous corriger sur l'essentiel (clarté, phrases utiles) plutôt que sur chaque petite faute." },
    ],
    first_step_this_week: "Choisissez une situation de votre travail (vous présenter en réunion) et dites trois phrases à voix haute, en vous enregistrant sur votre téléphone.",
  }),
  school_wound: (n) => ({
    headline: `${n}, l'anglais peut redevenir quelque chose de simple pour vous.`,
    profile_summary: "L'anglais à l'école a été une expérience difficile, et il en reste une impression que « ce n'est pas pour vous ». Pourtant, vous êtes là aujourd'hui, prêt(e) à reprendre : c'est le signe que l'envie est toujours présente.",
    what_holds_you_back: [
      { title: "Un mauvais souvenir de l'école", explanation: "Ce que vous avez vécu en cours a laissé de l'appréhension. Elle ressurgit dès qu'il faut parler anglais." },
      { title: "La peur du jugement", explanation: "La crainte qu'on remarque vos fautes vous pousse à rester silencieux. Moins vous parlez, plus le blocage s'installe." },
    ],
    reframe: "Ce n'est pas vous qui étiez « nul en anglais » : c'est le cadre qui ne vous convenait pas. Avec une approche douce et concrète, on peut reconstruire la confiance pas à pas.",
    your_strengths: ["La motivation de reprendre malgré un passé difficile", "Une expérience professionnelle sur laquelle s'appuyer", "Une vraie lucidité sur ce qui vous freine"],
    recommended_method: [
      { title: "De petites victoires d'abord", description: "Commencez par des phrases utiles et courtes, liées à votre quotidien, avant toute règle de grammaire." },
      { title: "Un cadre sans jugement", description: "Pratiquez dans un environnement bienveillant où l'erreur fait partie de l'apprentissage." },
      { title: "Une progression visible", description: "Gardez une trace de ce que vous savez dire chaque semaine pour mesurer vos progrès." },
    ],
    first_step_this_week: "Apprenez à vous présenter en trois phrases simples (nom, métier, ville) et dites-les à voix haute chaque jour.",
  }),
  immersion_returnee: (n) => ({
    headline: `${n}, votre anglais n'est pas perdu : il est en sommeil.`,
    profile_summary: "Vous avez vécu une immersion qui vous a fait progresser. Depuis votre retour, sans pratique régulière, votre niveau a reculé, et c'est frustrant après tant d'efforts.",
    what_holds_you_back: [
      { title: "Plus de pratique après le retour", explanation: "L'immersion vous faisait parler tous les jours. Sans cette pratique, les automatismes se sont endormis." },
      { title: "Le sentiment d'avoir perdu un acquis", explanation: "Penser avoir « tout perdu » décourage. En réalité, ce que vous avez appris revient vite quand on le réactive." },
    ],
    reframe: "Ce que vous avez construit pendant l'immersion ne disparaît pas. Il suffit d'une routine de pratique pour réveiller cet anglais, souvent plus vite que vous ne le pensez.",
    your_strengths: ["Une vraie expérience de l'anglais en situation réelle", "Une compréhension orale déjà entraînée", "La preuve que vous savez progresser"],
    recommended_method: [
      { title: "Réactiver par l'oral", description: "Reprenez des conversations courtes et régulières pour réveiller vos automatismes." },
      { title: "Une routine courte mais fixe", description: "Mieux vaut 15 minutes plusieurs fois par semaine qu'une longue séance de temps en temps." },
      { title: "Relier l'anglais à votre travail", description: "Pratiquez sur vos situations professionnelles réelles pour que l'anglais reste utile au quotidien." },
    ],
    first_step_this_week: "Racontez à voix haute, pendant deux minutes, un souvenir de votre séjour, en vous enregistrant.",
  }),
  francophone_bubble: (n) => ({
    headline: `${n}, ce n'est pas vous : c'est la bulle qui vous a retenu.`,
    profile_summary: "Vous êtes parti(e) dans un pays anglophone, mais vous êtes souvent resté(e) entre francophones. Vous avez entendu beaucoup d'anglais sans vraiment le pratiquer, et le résultat n'a pas été à la hauteur de vos attentes.",
    what_holds_you_back: [
      { title: "L'exposition sans pratique", explanation: "Entendre l'anglais ne suffit pas : il faut le parler. Rester entre francophones a limité ces occasions." },
      { title: "Le sentiment d'un investissement perdu", explanation: "Avoir donné du temps ou de l'argent sans le résultat espéré peut décourager de recommencer." },
    ],
    reframe: "Votre séjour n'était pas inutile : votre oreille s'est habituée à l'anglais. Il manque surtout une pratique orale guidée, ce qui se travaille très bien aujourd'hui.",
    your_strengths: ["Une oreille habituée à l'anglais", "Le courage d'être parti(e) pour apprendre", "Une motivation qui ne s'est pas éteinte"],
    recommended_method: [
      { title: "Une pratique orale guidée", description: "Des conversations encadrées, où vous parlez vraiment, avec un retour sur ce que vous dites." },
      { title: "Sortir de la zone de confort, doucement", description: "Des mises en situation courtes et à faible enjeu pour prendre l'habitude de parler." },
      { title: "Des objectifs concrets", description: "Préparez des situations précises de votre travail plutôt que de « pratiquer » sans but." },
    ],
    first_step_this_week: "Chaque jour, décrivez à voix haute en anglais ce que vous faites (« I'm writing an email to… ») pendant une minute.",
  }),
  speaking_block: (n) => ({
    headline: `${n}, vous comprenez déjà beaucoup : il est temps d'oser parler.`,
    profile_summary: "Vous comprenez souvent ce qu'on vous dit, mais au moment de répondre, les mots ne viennent pas. Vous préférez parfois éviter les situations où il faut parler, et cela vous coûte au travail.",
    what_holds_you_back: [
      { title: "Le blocage au moment de répondre", explanation: "Comprendre et parler sont deux compétences différentes. Vous avez surtout entraîné la première." },
      { title: "La peur des fautes et de l'accent", explanation: "Craindre le regard des autres vous pousse à vous taire, ce qui renforce le blocage." },
    ],
    reframe: "Ce blocage est très courant et il ne dit rien de vos capacités. Il se dépasse avec de la pratique orale régulière, dans des situations rassurantes, jusqu'à ce que parler devienne naturel.",
    your_strengths: ["Une bonne compréhension de l'anglais", "Une conscience claire de ce qui vous bloque", "Des situations de travail concrètes pour pratiquer"],
    recommended_method: [
      { title: "Un oral à faible enjeu", description: "Commencez par des échanges courts et sans pression pour habituer votre cerveau à répondre." },
      { title: "Des mises en situation préparées", description: "Répétez à l'avance vos réunions, appels et présentations pour arriver avec des phrases prêtes." },
      { title: "Des phrases de secours", description: "Apprenez des formules pour gagner du temps ou faire répéter (« Could you repeat that, please? »)." },
    ],
    first_step_this_week: "Apprenez trois phrases pour gagner du temps en réunion et utilisez-en une la prochaine fois que vous devez répondre.",
  }),
  inconsistent: (n) => ({
    headline: `${n}, la régularité compte plus que l'intensité.`,
    profile_summary: "Vous avez déjà essayé plusieurs fois de reprendre l'anglais, avec de vraies intentions. Mais le manque de temps ou l'absence de progrès visibles ont souvent fini par vous arrêter.",
    what_holds_you_back: [
      { title: "Des efforts difficiles à tenir", explanation: "Les méthodes essayées demandaient trop de temps ou d'énergie pour durer avec votre emploi du temps." },
      { title: "Des progrès peu visibles", explanation: "Sans voir où vous en êtes, il est difficile de rester motivé(e) sur la durée." },
    ],
    reframe: "Avoir arrêté n'est pas un échec personnel : les méthodes n'étaient pas adaptées à votre vie. Des séances très courtes, régulières et mesurables changent tout.",
    your_strengths: ["Une envie d'apprendre qui revient toujours", "De l'expérience sur ce qui ne marche pas pour vous", "La capacité à vous remettre en route"],
    recommended_method: [
      { title: "Des micro-sessions quotidiennes", description: "10 à 15 minutes par jour suffisent si elles sont régulières." },
      { title: "Des progrès visibles", description: "Suivez ce que vous savez faire chaque semaine pour voir le chemin parcouru." },
      { title: "Un contenu lié à votre travail", description: "Apprenez ce dont vous avez besoin tout de suite : cela donne une raison de continuer." },
    ],
    first_step_this_week: "Bloquez 10 minutes à la même heure trois jours cette semaine, et pratiquez une phrase utile pour votre travail.",
  }),
};

export function fallbackReport(profile: ProfileId, firstName: string, goals: string[], feelings: string[]): DiagnosticReport {
  const b = BASE[profile](firstName);
  const goal = goals.length ? goals.join(", ").toLowerCase() : "être à l'aise en anglais au travail";
  const feel = feelings.length ? ` et vous vous sentirez ${feelings.join(", ").toLowerCase()}` : "";
  const r: DiagnosticReport = {
    ...b,
    profile_name: PROFILE_INFO[profile].name,
    goal_reminder: `Dans 6 mois, votre objectif est clair : ${goal}. Ce jour-là, vous aurez fait le chemin${feel}.`,
  };
  // French typography (non-breaking spaces before « ? : ! ; »).
  return JSON.parse(fr(JSON.stringify(r)));
}
