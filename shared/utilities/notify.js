/**
 * One entry point for user notifications: WhatsApp when the user has a phone number and WhatsApp
 * is configured, email otherwise (and as a fallback when WhatsApp fails).
 *
 * channelFor(user):
 *   "whatsapp"      phone + WhatsApp configured
 *   "email"         email available (and no usable WhatsApp)
 *   "whatsapp-sim"  phone only, WhatsApp not configured yet (simulation: nothing reaches the user)
 *   null            no contact at all
 */
const Emailer = require("./sendEmail");
const whatsapp = require("./whatsapp");
const { displayPhone, normalizePhone } = require("./phone");

// phoneE164 is filled by the model's pre-validate hook; compute it here too for unsaved users
function phoneOf(user) {
  return user.phoneE164 || (user.phoneNumber ? normalizePhone(user.phoneNumber) : null);
}

function channelFor(user) {
  const phone = phoneOf(user);
  if (phone && whatsapp.isConfigured()) return "whatsapp";
  if (user.email) return "email";
  if (phone) return "whatsapp-sim";
  return null;
}

/**
 * Activation message. With WhatsApp the user receives a link and chooses the password on the site
 * (callers set user.passwordSetRequired = true beforehand — see prepareActivation); with email the
 * existing message (link + password) is sent.
 * → { channel, to, simulated?, fallback? }
 */
async function sendActivation(user, { activationUrl, activationToken, password }) {
  const ch = channelFor(user);
  if (ch === "whatsapp" || ch === "whatsapp-sim") {
    try {
      const r = await whatsapp.sendActivation(phoneOf(user), { firstName: user.name, username: user.username, token: activationToken });
      return { channel: "whatsapp", to: displayPhone(phoneOf(user)), simulated: !!r.simulated };
    } catch (err) {
      console.error("WhatsApp activation error:", err.message);
      if (!user.email) throw err;
      await new Emailer(user, activationUrl).sendActivationEmail(password);
      return { channel: "email", to: user.email, fallback: true };
    }
  }
  if (ch === "email") {
    await new Emailer(user, activationUrl).sendActivationEmail(password);
    return { channel: "email", to: user.email };
  }
  return { channel: null };
}

/** Before saving a new / re-activated account: WhatsApp users choose their password at activation. */
function prepareActivation(user) {
  const ch = channelFor(user);
  user.passwordSetRequired = ch === "whatsapp" || ch === "whatsapp-sim";
  return ch;
}

/** Flash message for the admin / institution after an activation attempt. */
function activationFlash(result, user, { password, activationUrl } = {}) {
  const who = `${user.name} ${user.surname} (@${user.username})`;
  if (result.channel === "whatsapp" && result.simulated) {
    return ["warning", `Compte créé pour ${who}. WhatsApp n'est pas encore configuré : transmettez-lui ce lien d'activation (il y choisira son mot de passe) : ${activationUrl}`];
  }
  if (result.channel === "whatsapp") {
    return ["success", `Compte créé pour ${who}. Un message WhatsApp d'activation a été envoyé au ${result.to} : la personne y choisira son mot de passe.`];
  }
  if (result.channel === "email") {
    return ["success", `Compte créé pour ${who}. Un email d'activation a été envoyé à ${result.to}${result.fallback ? " (WhatsApp indisponible)" : ""}.`];
  }
  return ["warning", `Compte créé pour ${who}, mais aucun message n'a pu être envoyé. Mot de passe : ${password}`];
}

/** Enrollment confirmation (fire-and-forget friendly: never throws). */
async function sendEnrollment(user, { courseTitle, start, end, loginUrl }) {
  const fmt = (d) => new Date(d).toLocaleDateString("fr-FR");
  const ch = channelFor(user);
  try {
    if (ch === "whatsapp") {
      await whatsapp.sendEnrollment(phoneOf(user), { firstName: user.name, courseTitle, startDate: fmt(start), endDate: fmt(end) });
      return "whatsapp";
    }
  } catch (err) {
    console.error("WhatsApp enrollment error:", err.message);
  }
  if (user.email) {
    try { await new Emailer(user).sendEnrollmentEmail(courseTitle, start, end, loginUrl); return "email"; }
    catch (err) { console.error("Enrollment email error:", err.message); }
  }
  return null;
}

module.exports = { phoneOf, channelFor, sendActivation, prepareActivation, activationFlash, sendEnrollment };
