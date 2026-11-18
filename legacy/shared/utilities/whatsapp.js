/**
 * WhatsApp Cloud API (Meta) — template messages only (business-initiated messages must use
 * templates approved in WhatsApp Manager).
 *
 * Environment:
 *   WHATSAPP_TOKEN            permanent system-user access token
 *   WHATSAPP_PHONE_NUMBER_ID  "Phone number ID" of the sending number (not the number itself)
 *   WHATSAPP_API_VERSION      optional, default v21.0
 *   WHATSAPP_TEMPLATE_LANG    optional, default fr
 *   WHATSAPP_TEMPLATE_ACTIVATION / _RESET / _ENROLLMENT   optional template names
 *
 * Without WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID the module is in *simulation* mode: nothing
 * is sent, the intent is logged (without codes) and callers fall back to email or show the link.
 */
const API_VERSION = () => process.env.WHATSAPP_API_VERSION || "v21.0";
const LANG = () => process.env.WHATSAPP_TEMPLATE_LANG || "fr";
const TEMPLATES = () => ({
  activation: process.env.WHATSAPP_TEMPLATE_ACTIVATION || "afrohk_activation",
  reset: process.env.WHATSAPP_TEMPLATE_RESET || "afrohk_code",
  enrollment: process.env.WHATSAPP_TEMPLATE_ENROLLMENT || "afrohk_inscription",
});

function isConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

const txt = (v) => ({ type: "text", text: String(v == null ? "" : v).slice(0, 900) });

async function sendTemplate(to, name, components) {
  if (!isConfigured()) {
    console.log(`[whatsapp:simulation] template "${name}" → ${to} (non envoyé : WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID absents)`);
    return { simulated: true };
  }
  const url = `https://graph.facebook.com/${API_VERSION()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name, language: { code: LANG() }, components },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = new Error(`WhatsApp API ${res.status}: ${(data.error && data.error.message) || "erreur inconnue"}`);
    e.details = data.error;
    throw e;
  }
  return { id: data.messages && data.messages[0] && data.messages[0].id };
}

/** Activation: body {{1}} prénom, {{2}} identifiant ; URL button with dynamic suffix = activation token. */
function sendActivation(to, { firstName, username, token }) {
  return sendTemplate(to, TEMPLATES().activation, [
    { type: "body", parameters: [txt(firstName), txt(username)] },
    { type: "button", sub_type: "url", index: "0", parameters: [txt(token)] },
  ]);
}

/** Authentication template (Meta's fixed text "{{1}} est votre code de vérification") + copy-code button. */
function sendCode(to, code) {
  return sendTemplate(to, TEMPLATES().reset, [
    { type: "body", parameters: [txt(code)] },
    { type: "button", sub_type: "url", index: "0", parameters: [txt(code)] },
  ]);
}

/** Enrollment: body {{1}} prénom, {{2}} formation, {{3}} début, {{4}} fin (static login button in the template). */
function sendEnrollment(to, { firstName, courseTitle, startDate, endDate }) {
  return sendTemplate(to, TEMPLATES().enrollment, [
    { type: "body", parameters: [txt(firstName), txt(courseTitle), txt(startDate), txt(endDate)] },
  ]);
}

module.exports = { isConfigured, sendTemplate, sendActivation, sendCode, sendEnrollment };
