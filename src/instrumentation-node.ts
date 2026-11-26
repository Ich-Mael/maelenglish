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
  } else if (!process.env.EMAIL_FROM?.trim() || /@smtp-brevo\.com>?$/i.test(process.env.EMAIL_FROM.trim())) {
    // same rule as emailSender() in src/lib/email.ts (not imported: server-only)
    warn("EMAIL_FROM manquant ou invalide : indiquez une adresse d'expéditeur vérifiée dans Brevo (ex. « MaelEnglish <contact@votre-domaine> »). Aucun email ne sera envoyé.");
  }
  if (process.env.STORAGE_DRIVER === "local") {
    warn("STORAGE_DRIVER=local : fichiers stockés sur le disque du serveur (tests locaux uniquement, jamais en production réelle).");
  } else if (!process.env.STORAGE_ENDPOINT || !process.env.STORAGE_BUCKET || !process.env.STORAGE_ACCESS_KEY_ID || !process.env.STORAGE_SECRET_ACCESS_KEY) {
    warn("STORAGE_* non configuré : les enregistrements audio ne peuvent pas être envoyés (Cloudflare R2, voir DECISIONS.md).");
  }
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    warn("WHATSAPP_* non configuré : les notifications d'inscription WhatsApp sont en simulation (email utilisé à la place).");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    warn("ANTHROPIC_API_KEY non configuré : les activités d'expression écrite ne peuvent pas être corrigées par Claude.");
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    warn("ELEVENLABS_API_KEY non configuré : le partenaire de conversation IA (Talk with Coach Ish) n'est pas disponible.");
  }
  if (!process.env.DAILY_API_KEY) {
    warn("DAILY_API_KEY non configuré : les séances de coaching en direct utilisent le lien de secours (Zoom / Meet) du coaching.");
  }
  if (!process.env.CINETPAY_API_KEY || !process.env.CINETPAY_SITE_ID) {
    warn("CINETPAY_API_KEY / CINETPAY_SITE_ID non configurés : la boutique n'accepte pas de paiement en ligne (WhatsApp proposé).");
  }
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    warn("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION non configurés : le dictionnaire utilise les enregistrements disponibles ou la voix du navigateur.");
  }
}
