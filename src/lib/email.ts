import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email via SMTP (Brevo). Without EMAIL_HOST / EMAIL_USERNAME the
 * module runs in simulation mode: nothing is sent and, outside production, the
 * message (with its link) is logged so the flows can be tested locally.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD);
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
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:simulation] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    } else {
      console.warn(`[email:simulation] email not configured, "${mail.subject}" not sent`);
    }
    return { simulated: true };
  }
  await transport().sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME, ...mail });
  return { simulated: false };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Table layout, inlined styles and a "bulletproof" button (some clients strip <style>). */
function layout(p: { firstName: string; intro: string; button: string; url: string; outro: string }) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f8fd;font-family:Arial,Helvetica,sans-serif;color:#151a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fd;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e3e7f3">
<tr><td style="padding:28px 28px 8px"><img src="${appUrl("/images/maelenglish-logo.png")}" alt="MaelEnglish" width="160" style="display:block;border:0;height:auto"></td></tr>
<tr><td style="padding:8px 28px;font-size:16px;line-height:1.55">
<p style="margin:0 0 12px">Bonjour ${esc(p.firstName)},</p>
<p style="margin:0 0 20px">${p.intro}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#364fab" style="border-radius:10px">
<a href="${p.url}" style="display:inline-block;padding:13px 24px;color:#ffffff;font-weight:bold;text-decoration:none;font-size:16px">${p.button}</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:13px;color:#5b6283">Si le bouton ne fonctionne pas, copiez ce lien :<br><a href="${p.url}" style="color:#364fab;word-break:break-all">${p.url}</a></p>
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

export function sendEnrollmentEmail(to: string, p: { firstName: string; courseTitle: string; startDate: string; endDate: string | null }) {
  const url = appUrl("/mes-cours");
  const period = p.endDate ? `du ${p.startDate} au ${p.endDate}` : `à partir du ${p.startDate}`;
  return send({
    to,
    subject: `Inscription confirmée : ${p.courseTitle}`,
    html: layout({
      firstName: p.firstName,
      intro: `Vous êtes inscrit(e) à <strong>${esc(p.courseTitle)}</strong>, ${esc(period)}. Retrouvez vos leçons dans votre espace :`,
      button: "Accéder à mes cours",
      url,
      outro: "Bonne formation avec MaelEnglish !",
    }),
    text: `Bonjour ${p.firstName},\n\nVous êtes inscrit(e) à ${p.courseTitle}, ${period}.\nVos cours : ${url}`,
  });
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
