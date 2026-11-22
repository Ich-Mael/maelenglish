/*
 * The spec's launch set of AI role-plays (AIC-02, 8 scenarios) as Lab activities. Created as
 * drafts (review them in /admin/labo, try them with « Learner preview », then mark them ready);
 * `--ready` creates them ready. A scenario whose title already exists is skipped.
 *   npm run seed:roleplays [-- --ready]
 */
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { Activity } from "../src/models";
import { cleanContent } from "../src/lib/lab/content";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const uri = process.env.APP_DB;
if (!uri) throw new Error("APP_DB missing (.env.local).");
if (/afrohk/i.test(uri)) {
  console.error("Refused: APP_DB points to the AfroHK database.");
  process.exit(1);
}

type Seed = { title: string; level: string; theme: string; minutes: number; difficulty: number; situation: string; aiRole: string; learnerRole: string; setting: string; goals: string[]; phrases: string[]; twists: string[]; opening: string; tip: string };

const SCENARIOS: Seed[] = [
  {
    title: "HR screening interview",
    level: "B1",
    theme: "interviews",
    minutes: 8,
    difficulty: 2,
    situation: "Vous passez un premier entretien en visio avec la responsable RH d'une ONG internationale, pour un poste de chargé(e) de projet.",
    aiRole: "Mrs Grace Mensah, HR manager at an international NGO",
    learnerRole: "a candidate for a Project Officer position",
    setting: "a video call, first-round screening interview of about ten minutes",
    goals: ["Introduce yourself in under 60 seconds", "Explain why you want this role", "Give one example of teamwork", "Ask one question about the role"],
    phrases: ["I have … years of experience in …", "What attracted me to this role is …", "For example, in my last job, I …", "Could you tell me more about …?"],
    twists: ["Ask about a gap in the candidate's CV", "Ask about their salary expectations"],
    opening: "Hello, thanks for joining. Can you hear me well?",
    tip: "Préparez votre présentation en 3 parties : qui vous êtes, ce que vous savez faire, ce que vous voulez.",
  },
  {
    title: "Competency interview (STAR answers)",
    level: "B2",
    theme: "interviews",
    minutes: 10,
    difficulty: 3,
    situation: "Deuxième entretien pour un poste de superviseur(e). Le recruteur pose des questions sur des situations réelles : répondez avec la méthode STAR (Situation, Tâche, Action, Résultat).",
    aiRole: "Mr David Clarke, operations director of a logistics company",
    learnerRole: "a candidate for a team supervisor position",
    setting: "an in-person competency-based interview in the director's office",
    goals: ["Describe a difficult situation you handled, with the result", "Explain how you solved a conflict in a team", "Talk about a mistake you made and what you learned", "Show you can meet deadlines under pressure"],
    phrases: ["The situation was …", "My task was to …", "So what I did was …", "As a result, …", "What I learned from it is …"],
    twists: ["Ask for more detail when an answer has no clear result", "Ask what the candidate would do differently today"],
    opening: "Good morning, please have a seat. Thank you for coming back for this second interview.",
    tip: "Terminez toujours par le résultat, avec un chiffre si possible : « we reduced delays by 20 % ».",
  },
  {
    title: "Salary negotiation",
    level: "B2",
    theme: "negotiation",
    minutes: 8,
    difficulty: 3,
    situation: "On vous propose le poste ! La DRH vous appelle pour l'offre. Le salaire proposé est plus bas que ce que vous espériez : négociez poliment.",
    aiRole: "Ms Linda Owusu, HR director of a telecom company",
    learnerRole: "a candidate who has just been offered a job",
    setting: "a phone call to discuss the job offer",
    goals: ["Thank her and show your interest in the job", "Say clearly the salary you expect and why", "Propose an alternative if the salary can't change (bonus, training, days off)", "Agree on a next step"],
    phrases: ["I'm really excited about this opportunity.", "Based on my experience, I was expecting …", "Would there be some flexibility on …?", "Could we consider … instead?"],
    twists: ["Say the budget is fixed for the first year", "Offer a review after six months instead of a higher salary"],
    opening: "Hello, it's Linda from HR. I have good news: we'd like to offer you the position!",
    tip: "Ne dites jamais votre chiffre en premier sans l'avoir justifié : expérience, marché, résultats.",
  },
  {
    title: "Client meeting",
    level: "B1",
    theme: "meetings",
    minutes: 8,
    difficulty: 2,
    situation: "Vous rencontrez un nouveau client pour comprendre ses besoins avant de lui faire une proposition.",
    aiRole: "Mr Samuel Adeyemi, purchasing manager of a hotel chain",
    learnerRole: "a sales representative of a supplier company",
    setting: "a first meeting in the client's office",
    goals: ["Greet the client and introduce your company", "Ask at least three questions about their needs", "Summarise what the client needs", "Propose a next step (a quote, a demo, another meeting)"],
    phrases: ["Thank you for taking the time to meet me.", "Could you tell me about your current …?", "If I understand correctly, you need …", "What I suggest is …"],
    twists: ["Mention that a competitor offered a lower price", "Say the decision must be made before the end of the month"],
    opening: "Good morning, welcome. Please, sit down. So, tell me about your company.",
    tip: "Écoutez plus que vous ne parlez : le client vous dit lui-même comment le convaincre.",
  },
  {
    title: "Handling a complaint",
    level: "B1",
    theme: "customer-service",
    minutes: 5,
    difficulty: 3,
    situation: "Un client mécontent vous appelle : sa commande est arrivée en retard et incomplète. Calmez-le et trouvez une solution.",
    aiRole: "Mrs Amina Diallo, an unhappy customer whose order arrived late and incomplete",
    learnerRole: "a customer service agent",
    setting: "a phone call to the customer service line",
    goals: ["Apologise and show empathy", "Ask questions to understand the problem", "Propose a concrete solution", "Confirm what happens next and when"],
    phrases: ["I'm really sorry to hear that.", "I completely understand your frustration.", "Could you give me your order number?", "What I can do for you is …", "You will receive … by …"],
    twists: ["Get angry again if the first solution is vague", "Ask to speak to a manager"],
    opening: "Hello? Yes, I'm calling about my order. This is the second time I call and nobody helps me!",
    tip: "Reformulez le problème du client avant de proposer une solution : il se sent écouté et se calme.",
  },
  {
    title: "Presenting results to your manager",
    level: "B1",
    theme: "presentations",
    minutes: 5,
    difficulty: 3,
    situation: "Votre responsable vous demande un point rapide sur les résultats du trimestre de votre équipe.",
    aiRole: "Mr Thomas Boateng, head of department, busy and direct",
    learnerRole: "a team leader presenting the quarter's results",
    setting: "a short meeting in the manager's office",
    goals: ["Give the main result in one sentence", "Explain one success and one problem with figures", "Explain what you will do about the problem", "Answer the manager's questions clearly"],
    phrases: ["Overall, this quarter we …", "Sales went up by …", "The main challenge was …", "To fix this, we plan to …"],
    twists: ["Interrupt to ask why one figure is lower than last quarter", "Ask for a decision on the budget"],
    opening: "Come in. I've got ten minutes before my next meeting. So, how was the quarter?",
    tip: "Commencez par la conclusion, puis les détails : votre manager a peu de temps.",
  },
  {
    title: "Networking small talk",
    level: "A2",
    theme: "small-talk",
    minutes: 5,
    difficulty: 1,
    situation: "Pause café pendant une conférence professionnelle à Accra. Une personne vient vous parler.",
    aiRole: "Kofi, a friendly participant at a business conference",
    learnerRole: "a professional attending the conference",
    setting: "the coffee break of a business conference",
    goals: ["Introduce yourself and say what you do", "Ask the other person two questions about their work", "Find something you have in common", "End the conversation politely and exchange contacts"],
    phrases: ["Hi, I'm … Nice to meet you.", "What do you do?", "How did you find the last talk?", "It was great talking to you.", "Shall we exchange contacts?"],
    twists: ["Mention that you are looking for partners in the learner's sector"],
    opening: "Hi there! Great coffee, isn't it? Is this your first time at this conference?",
    tip: "Une question ouverte (« What do you think of … ? ») fait durer la conversation.",
  },
  {
    title: "Phone call with a supplier",
    level: "B1",
    theme: "calls",
    minutes: 5,
    difficulty: 3,
    situation: "Vous appelez un fournisseur pour une livraison urgente. La ligne est mauvaise : faites répéter et vérifiez les informations importantes.",
    aiRole: "Mr Peter Mwangi, sales contact at an office supplies company, on a bad phone line",
    learnerRole: "an office manager who needs an urgent delivery",
    setting: "a phone call with poor audio quality; the supplier sometimes cuts out",
    goals: ["Explain what you need and how much", "Ask for the delivery date and the price", "Ask the supplier to repeat when you don't understand", "Check the details at the end (spell a name, repeat numbers)"],
    phrases: ["Sorry, the line is bad. Could you repeat that?", "Did you say fifteen or fifty?", "Could you spell that, please?", "Let me read it back to you: …"],
    twists: ["Pretend the line cuts during an important number, so the learner must check it", "Say the product is out of stock and offer an alternative"],
    opening: "Hello, Office Plus, Peter speaking… hello? Sorry, the line is not very good today.",
    tip: "Répétez toujours les chiffres et les noms à la fin : « Let me read it back to you ».",
  },
];

async function main() {
  const ready = process.argv.includes("--ready");
  await mongoose.connect(uri!);
  let created = 0;
  for (const s of SCENARIOS) {
    if (await Activity.exists({ type: "role_play", title: s.title })) {
      console.log(`skip  ${s.title} (already there)`);
      continue;
    }
    const content = cleanContent("role_play", {
      situation: `<p>${s.situation}</p>`,
      aiRole: s.aiRole,
      learnerRole: s.learnerRole,
      setting: s.setting,
      goals: s.goals,
      targetPhrases: s.phrases,
      twists: s.twists,
      openingLine: s.opening,
      difficulty: s.difficulty,
      maxMinutes: s.minutes,
    });
    await Activity.create({ type: "role_play", title: s.title, level: s.level, theme: s.theme, skills: ["speaking"], durationMin: s.minutes, maelTip: s.tip, status: ready ? "ready" : "draft", content });
    created++;
    console.log(`added ${s.title}`);
  }
  console.log(`${created} role-play(s) created${ready ? " (ready)" : " as drafts"}.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
