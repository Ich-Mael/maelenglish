/**
 * Startup configuration check (Node.js runtime only — loaded by instrumentation.ts).
 * Refuses to start without a database (or with the AfroHK one) and warns about
 * missing production settings, visible in the Render logs.
 */
export function checkConfig() {
  const prod = process.env.NODE_ENV === "production";
  const fail = (msg: string) => {
    console.error(`[config] ${msg}`);
    if (prod) process.exit(1);
  };
  if (!process.env.APP_DB) fail("APP_DB manquant : définissez l'adresse de la base MongoDB MaelEnglish.");
  else if (/afrohk/i.test(process.env.APP_DB)) fail("APP_DB pointe vers la base AfroHK : utilisez la base MaelEnglish dédiée.");
  if (!prod) return;

  const warn = (msg: string) => console.warn(`[config] ${msg}`);
  const url = process.env.APP_URL ?? "";
  if (!url || /localhost|afrohk|onrender\.com/i.test(url)) {
    warn(`APP_URL = « ${url || "(vide)"} » : les liens des emails, le sitemap et les images de partage utiliseront cette adresse. Mettez le domaine définitif (https://…).`);
  }
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    warn("EMAIL_* non configuré : les liens d'activation et de réinitialisation ne seront pas envoyés par email.");
  }
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    warn("WHATSAPP_* non configuré : les notifications d'inscription WhatsApp sont en simulation (email utilisé à la place).");
  }
}
