import "server-only";

/**
 * WhatsApp Cloud API (Meta) — template messages only (business-initiated
 * messages must use templates approved in WhatsApp Manager).
 *
 * Environment:
 *   WHATSAPP_TOKEN            permanent system-user access token
 *   WHATSAPP_PHONE_NUMBER_ID  "Phone number ID" of the sending number (not the number itself)
 *   WHATSAPP_API_VERSION      optional, default v21.0
 *   WHATSAPP_TEMPLATE_LANG    optional, default fr
 *   WHATSAPP_TEMPLATE_ENROLLMENT  optional template name (default maelenglish_inscription)
 *
 * Passwords never go through WhatsApp: activation and reset links are sent by
 * email, or handed over by an admin for learners without email.
 *
 * Without WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID the module runs in
 * *simulation* mode: nothing is sent and the intent is logged.
 */

type TextParam = { type: "text"; text: string };
type Component =
  | { type: "body"; parameters: TextParam[] }
  | { type: "button"; sub_type: "url"; index: string; parameters: TextParam[] };

export type SendResult = { simulated: true } | { simulated?: false; id?: string };

const apiVersion = () => process.env.WHATSAPP_API_VERSION || "v21.0";
const lang = () => process.env.WHATSAPP_TEMPLATE_LANG || "fr";
const templates = () => ({
  enrollment: process.env.WHATSAPP_TEMPLATE_ENROLLMENT || "maelenglish_inscription",
});

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

const txt = (v: unknown): TextParam => ({ type: "text", text: String(v ?? "").slice(0, 900) });

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

export async function sendTemplate(to: string, name: string, components: Component[]): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    console.log(`[whatsapp:simulation] template "${name}" → ${to} (non envoyé : WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID absents)`);
    return { simulated: true };
  }
  const url = `https://graph.facebook.com/${apiVersion()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name, language: { code: lang() }, components },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    messages?: { id: string }[];
  };
  if (!res.ok || data.error) {
    throw new WhatsAppError(`WhatsApp API ${res.status}: ${data.error?.message ?? "erreur inconnue"}`, data.error);
  }
  return { id: data.messages?.[0]?.id };
}

/** Enrollment: body {{1}} first name, {{2}} course, {{3}} start, {{4}} end (static login button in the template). */
export function sendEnrollment(
  to: string,
  p: { firstName: string; courseTitle: string; startDate: string; endDate: string },
) {
  return sendTemplate(to, templates().enrollment, [
    { type: "body", parameters: [txt(p.firstName), txt(p.courseTitle), txt(p.startDate), txt(p.endDate)] },
  ]);
}
