import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { PHONE_DISPLAY } from "./site";

/**
 * Transactional email via SMTP (Brevo). Without EMAIL_HOST / EMAIL_USERNAME / EMAIL_PASSWORD
 * and a valid EMAIL_FROM the module runs in simulation mode: nothing is sent and, outside
 * production, the message (with its link) is logged so the flows can be tested locally.
 * Callers check `simulated` before telling staff an email went out.
 */

/**
 * Sender address: must be a sender verified in Brevo (Senders & IP), e.g.
 * « MaelEnglish <contact@your-domain> » (a bare address gets the « MaelEnglish » display name). The Brevo SMTP login (…@smtp-brevo.com) is not a
 * sender: Brevo accepts the message but never delivers it.
 */
export function emailSender(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from || /@smtp-brevo\.com>?$/i.test(from)) return null;
  // A bare address shows as its local part in inboxes (« contact »): add the brand name.
  return from.includes("<") ? from : `"MaelEnglish" <${from}>`;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD && emailSender());
}

let transporter: Transporter | null = null;
function transport(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    auth: { user: process.env.EMAIL_USERNAME, pass: process.env.EMAIL_PASSWORD },
  });
  return transporter;
}

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

type Mail = { to: string; subject: string; html: string; text: string };

async function send(mail: Mail): Promise<{ simulated: boolean }> {
  if (!isEmailConfigured()) {
    if (process.env.EMAIL_HOST && !emailSender()) {
      console.warn(`[email] EMAIL_FROM manquant ou invalide (adresse d'expéditeur vérifiée dans Brevo requise) : "${mail.subject}" non envoyé.`);
    }
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:simulation] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    } else {
      console.warn(`[email:simulation] email not configured, "${mail.subject}" not sent`);
    }
    return { simulated: true };
  }
  await transport().sendMail({ from: emailSender()!, ...mail });
  return { simulated: false };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Table layout, inlined styles and a "bulletproof" button (some clients strip <style>). */
function layout(p: { firstName: string; intro: string; button: string; url: string; outro: string; hero?: { src: string; alt: string }; extra?: string; lang?: "fr" | "en" }) {
  const en = p.lang === "en"; // staff emails (coach digests) are in English, like the admin
  return `<!doctype html><html lang="${en ? "en" : "fr"}"><body style="margin:0;background:#f7f8fd;font-family:Arial,Helvetica,sans-serif;color:#151a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fd;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e3e7f3">
<tr><td style="padding:28px 28px 8px"><img src="${appUrl("/images/maelenglish-logo.png")}" alt="MaelEnglish" width="160" style="display:block;border:0;height:auto"></td></tr>${
    p.hero
      ? `\n<tr><td style="padding:12px 28px 4px"><img src="${p.hero.src}" alt="${esc(p.hero.alt)}" width="464" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px"></td></tr>`
      : ""
  }
<tr><td style="padding:8px 28px;font-size:16px;line-height:1.55">
<p style="margin:0 0 12px">${en ? "Hello" : "Bonjour"} ${esc(p.firstName)},</p>
<p style="margin:0 0 20px">${p.intro}</p>${p.extra ?? ""}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#364fab" style="border-radius:10px">
<a href="${p.url}" style="display:inline-block;padding:13px 24px;color:#ffffff;font-weight:bold;text-decoration:none;font-size:16px">${p.button}</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:13px;color:#5b6283">${en ? "If the button doesn't work, copy this link:" : "Si le bouton ne fonctionne pas, copiez ce lien :"}<br><a href="${p.url}" style="color:#364fab;word-break:break-all">${p.url}</a></p>
<p style="margin:16px 0 0;font-size:13px;color:#5b6283">${p.outro}</p>
</td></tr>
<tr><td style="padding:20px 28px 28px;font-size:12px;color:#8a90ab">MaelEnglish · Speak the Language of Your Profession</td></tr>
</table></td></tr></table></body></html>`;
}

export function sendActivationEmail(to: string, p: { firstName: string; username: string; token: string }) {
  const url = appUrl(`/activer/${p.token}`);
  return send({
    to,
    subject: "Activez votre compte MaelEnglish",
    html: layout({
      firstName: p.firstName,
      intro: `Votre compte MaelEnglish a été créé. Votre identifiant est <strong>${esc(p.username)}</strong>. Choisissez votre mot de passe pour commencer :`,
      button: "Choisir mon mot de passe",
      url,
      outro: "Ce lien est valable 7 jours.",
    }),
    text: `Bonjour ${p.firstName},\n\nVotre compte MaelEnglish a été créé (identifiant : ${p.username}).\nChoisissez votre mot de passe : ${url}\n\nCe lien est valable 7 jours.`,
  });
}

export function sendPasswordResetEmail(to: string, p: { firstName: string; token: string }) {
  const url = appUrl(`/reinitialiser/${p.token}`);
  return send({
    to,
    subject: "Réinitialisation de votre mot de passe MaelEnglish",
    html: layout({
      firstName: p.firstName,
      intro: "Vous avez demandé à changer votre mot de passe. Cliquez sur le bouton pour en choisir un nouveau :",
      button: "Changer mon mot de passe",
      url,
      outro: "Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    }),
    text: `Bonjour ${p.firstName},\n\nChoisissez un nouveau mot de passe : ${url}\n\nCe lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  });
}

/**
 * Enrolment confirmation: course image, dates, what the learner will be able to do (programme
 * objectives, else the course description), a button straight to the course.
 */
export type EnrollmentEmail = { firstName: string; courseTitle: string; startDate: string; endDate: string | null; courseUrl?: string; imageUrl?: string | null; objectives?: readonly string[]; summary?: string };

export function sendEnrollmentEmail(to: string, p: EnrollmentEmail) {
  return send({ to, ...enrollmentEmail(p) });
}

/** Subject, HTML and text of the enrolment email (separate for previews and tests). */
export function enrollmentEmail(p: EnrollmentEmail): Omit<Mail, "to"> {
  const url = p.courseUrl ?? appUrl("/mes-cours");
  const dates = p.endDate ? `Du ${p.startDate} au ${p.endDate}` : `À partir du ${p.startDate}`;
  const goals = (p.objectives ?? []).slice(0, 5);
  const blue = "#364fab";
  const extra = [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#eef1fb;border-radius:10px"><tr><td style="padding:12px 16px;font-size:15px;color:#141f4d"><strong>Vos dates</strong><br>${esc(dates)}</td></tr></table>`,
    goals.length
      ? `<p style="margin:0 0 8px;font-weight:bold;color:#141f4d">Ce que vous saurez faire</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px">${goals
          .map((g) => `<tr><td valign="top" style="padding:3px 10px 3px 0;color:${blue};font-weight:bold">&#10003;</td><td style="padding:3px 0;font-size:15px">${esc(g)}</td></tr>`)
          .join("")}</table>`
      : p.summary
        ? `<p style="margin:0 0 8px;font-weight:bold;color:#141f4d">Au programme</p><p style="margin:0 0 22px;font-size:15px">${esc(p.summary)}</p>`
        : "",
  ].join("");
  return {
    subject: `Bienvenue dans ${p.courseTitle} !`,
    html: layout({
      firstName: p.firstName,
      hero: p.imageUrl ? { src: p.imageUrl, alt: p.courseTitle } : undefined,
      intro: `Votre inscription à <strong>${esc(p.courseTitle)}</strong> est confirmée. Votre parcours est prêt : il ne vous reste plus qu’à commencer.`,
      extra,
      button: "Commencer mon cours",
      url,
      outro: `Notre conseil : un peu chaque jour, même 15 minutes, fait toute la différence. Une question ? Écrivez-nous sur WhatsApp au ${esc(PHONE_DISPLAY)}.<br><br>Bonne formation !<br>Coach Ish et l’équipe MaelEnglish`,
    }),
    text: [
      `Bonjour ${p.firstName},`,
      "",
      `Votre inscription à ${p.courseTitle} est confirmée. Votre parcours est prêt : il ne vous reste plus qu'à commencer.`,
      "",
      dates,
      ...(goals.length ? ["", "Ce que vous saurez faire :", ...goals.map((g) => `- ${g}`)] : p.summary ? ["", `Au programme : ${p.summary}`] : []),
      "",
      `Commencer mon cours : ${url}`,
      "",
      `Une question ? WhatsApp : ${PHONE_DISPLAY}`,
      "Bonne formation ! Coach Ish et l'équipe MaelEnglish",
    ].join("\n"),
  };
}

/** Staff notification: a new sign-up request arrived from /inscription. */
export function sendNewRequestEmail(to: string[], r: { name: string; phone: string; email: string; offer: string; kind: string; message: string }) {
  const url = appUrl("/admin/demandes");
  const lines = [`Nom : ${r.name}`, `WhatsApp : ${r.phone}`, r.email && `Email : ${r.email}`, `Programme : ${r.offer}`, r.message && `Message : ${r.message}`].filter(Boolean) as string[];
  return send({
    to: to.join(", "),
    subject: `${r.kind === "notify" ? "Demande d'information" : "Nouvelle demande d'inscription"} : ${r.name}`,
    html: layout({
      firstName: "l'équipe",
      intro: `${r.kind === "notify" ? "Une personne souhaite être prévenue de l'ouverture d'un programme." : "Une nouvelle demande d'inscription vient d'arriver."}<br><br>${lines.map(esc).join("<br>")}`,
      button: "Voir les demandes",
      url,
      outro: "Recontactez la personne sur WhatsApp, puis créez son compte depuis l'administration.",
    }),
    text: `${lines.join("\n")}\n\nDemandes : ${url}`,
  });
}

// ── Speaking challenges ────────────────────────────────────────────────────

/** Learner: their coach validated or returned a speaking challenge (French). */
export function sendChallengeReviewedEmail(
  to: string,
  p: { firstName: string; challengeTitle: string; courseTitle: string; decision: "graded" | "returned"; grade: number | null; maxScore: number; coachName: string; feedback: string; voiceNote?: boolean; url: string },
) {
  const ok = p.decision === "graded";
  const coach = p.coachName || "Votre coach"; // « Coach Ish » (coachLabel)
  const intro = ok
    ? `${esc(coach)} a validé votre défi oral <strong>« ${esc(p.challengeTitle)} »</strong> (${esc(p.courseTitle)})${p.grade !== null ? ` avec la note <strong>${p.grade} / ${p.maxScore}</strong>` : ""}. Bravo !`
    : `${esc(coach)} a écouté votre défi oral <strong>« ${esc(p.challengeTitle)} »</strong> (${esc(p.courseTitle)}) et vous demande de le reprendre.`;
  const feedback = p.feedback.trim();
  const extra = feedback
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#eef1fb;border-radius:10px"><tr><td style="padding:12px 16px;font-size:15px;color:#141f4d"><strong>Son retour</strong><br>${esc(feedback.slice(0, 600))}${feedback.length > 600 ? "…" : ""}</td></tr></table>`
    : "";
  const voice = p.voiceNote
    ? `<p style="margin:0 0 20px;font-size:15px;color:#141f4d">🎙️ <strong>${esc(coach)} vous a laissé un message vocal</strong> : écoutez-le dans l'application.</p>`
    : "";
  return send({
    to,
    subject: ok ? `Défi validé : ${p.challengeTitle}` : `Votre coach vous a fait un retour : ${p.challengeTitle}`,
    html: layout({
      firstName: p.firstName,
      intro,
      extra: voice + extra,
      button: ok ? "Voir mes défis" : "Reprendre le défi",
      url: p.url,
      outro: ok ? "Continuez sur votre lancée : chaque défi vous rapproche d'un anglais fluide au travail." : "Réécoutez votre enregistrement, appliquez le conseil de votre coach et renvoyez votre défi.",
    }),
    text: `Bonjour ${p.firstName},\n\n${intro.replace(/<[^>]+>/g, "")}\n${p.voiceNote ? `\n${coach} vous a laissé un message vocal : écoutez-le dans l'application.\n` : ""}${feedback ? `\nSon retour : ${feedback}\n` : ""}\n${p.url}`,
  });
}

/** Learner: their coach sent feedback on a writing task (French). */
export function sendWritingReviewedEmail(to: string, p: { firstName: string; title: string; courseTitle: string; coachName: string; score: number | null; comment: string; redoAsked: boolean; url: string }) {
  const coach = p.coachName || "Votre coach";
  const intro = `${esc(coach)} a corrigé votre texte <strong>« ${esc(p.title)} »</strong> (${esc(p.courseTitle)})${p.score !== null ? ` : <strong>${p.score} / 100</strong>` : ""}.${p.redoAsked ? " Votre coach vous demande d'envoyer une nouvelle version." : ""}`;
  const comment = p.comment.trim();
  const extra = comment
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#eef1fb;border-radius:10px"><tr><td style="padding:12px 16px;font-size:15px;color:#141f4d"><strong>Son commentaire</strong><br>${esc(comment.slice(0, 600))}${comment.length > 600 ? "…" : ""}</td></tr></table>`
    : "";
  return send({
    to,
    subject: p.redoAsked ? `Votre coach vous demande une nouvelle version : ${p.title}` : `Votre texte est corrigé : ${p.title}`,
    html: layout({
      firstName: p.firstName,
      intro,
      extra,
      button: p.redoAsked ? "Voir les corrections et réécrire" : "Voir mes corrections",
      url: p.url,
      outro: p.redoAsked ? "Lisez les corrections, puis envoyez votre nouvelle version : c'est en réécrivant qu'on progresse." : "Relisez les corrections : chaque texte vous rapproche d'un anglais professionnel sûr de lui.",
    }),
    text: `Bonjour ${p.firstName},

${intro.replace(/<[^>]+>/g, "")}
${comment ? `
Son commentaire : ${comment}
` : ""}
${p.url}`,
  });
}

/** A waiting item in the coach digest: a speaking challenge or a writing task. */
export type DigestItem = { learner: string; course: string; unit: string; hoursWaiting: number; late: boolean; url: string; kind?: "speaking" | "writing" };

const waited = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} days` : `${Math.max(1, Math.round(h))} h`);
function digestTable(items: DigestItem[], withCoach?: (i: DigestItem) => string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;font-size:14px">${items
    .slice(0, 30)
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e3e7f3"><strong>${esc(i.learner)}</strong>${withCoach ? ` <span style="color:#5b6283">· ${esc(withCoach(i))}</span>` : ""}<br><span style="color:#5b6283">${i.kind === "writing" ? "Writing · " : "Speaking · "}${esc(i.course)}${i.unit ? ` · ${esc(i.unit)}` : ""}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e3e7f3;white-space:nowrap;color:${i.late ? "#b02a2a" : "#5b6283"};font-weight:${i.late ? "bold" : "normal"}">${i.late ? "Late · " : ""}${waited(i.hoursWaiting)}</td></tr>`,
    )
    .join("")}</table>${items.length > 30 ? `<p style="margin:0 0 16px;font-size:13px;color:#5b6283">…and ${items.length - 30} more.</p>` : ""}`;
}

/** Coach: daily list of the speaking challenges and writing tasks waiting for them (English, like the admin). */
export function sendCoachDigestEmail(to: string, p: { firstName: string; items: DigestItem[]; dueHours: number }) {
  const late = p.items.filter((i) => i.late).length;
  const writing = p.items.filter((i) => i.kind === "writing").length;
  const speaking = p.items.length - writing;
  const what = [speaking ? `${speaking} speaking challenge(s)` : "", writing ? `${writing} writing task(s)` : ""].filter(Boolean).join(" and ");
  const url = appUrl(speaking ? "/admin/corrections?coach=me" : "/admin/corrections/ecrits?coach=me");
  return send({
    to,
    subject: late ? `${late} late · ${p.items.length} to review (${what})` : `${p.items.length} to review: ${what}`,
    html: layout({
      lang: "en",
      firstName: p.firstName,
      intro: `${what} are waiting for your feedback${late ? `, <strong style="color:#b02a2a">${late} of them waiting more than ${p.dueHours} hours</strong>` : ""}. Learners stay motivated when they hear back quickly.${writing && speaking ? " Writing tasks are in Grading → Writing review." : ""}`,
      extra: digestTable(p.items),
      button: "Open my grading queue",
      url,
      outro: `Target: every challenge reviewed within ${p.dueHours} hours of being sent.`,
    }),
    text: `Hello ${p.firstName},\n\n${what} to review (${late} late).\n\n${p.items.map((i) => `- ${i.kind === "writing" ? "Writing" : "Speaking"} · ${i.learner} · ${i.course} · ${i.unit} · ${i.late ? "LATE · " : ""}${waited(i.hoursWaiting)}`).join("\n")}\n\n${url}`,
  });
}

/** Admins: late speaking challenges across coaches (English). */
export function sendAdminLateDigestEmail(to: string[], p: { items: (DigestItem & { coach: string })[]; dueHours: number }) {
  const url = appUrl("/admin/suivi");
  return send({
    to: to.join(", "),
    subject: `${p.items.length} learner answer(s) waiting more than ${p.dueHours} h`,
    html: layout({
      lang: "en",
      firstName: "team",
      intro: `These speaking challenges and writing tasks have been waiting for a coach for more than ${p.dueHours} hours:`,
      extra: digestTable(p.items, (i) => (i as DigestItem & { coach: string }).coach || "no coach"),
      button: "Open coach oversight",
      url,
      outro: "Check in with the coaches concerned, or reassign the learners from their user page.",
    }),
    text: `Late speaking challenges and writing tasks (> ${p.dueHours} h):\n\n${p.items.map((i) => `- ${i.learner} · ${i.coach || "no coach"} · ${i.course} · ${waited(i.hoursWaiting)}`).join("\n")}\n\n${url}`,
  });
}
