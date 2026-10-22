/**
 * WhatsApp Cloud API webhook — mounted at /webhooks/whatsapp BEFORE the body parsers and the session
 * (it needs the raw body to check Meta's signature and has no use for cookies).
 *
 *   GET  verification handshake: Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge;
 *        we echo the challenge when the token equals WHATSAPP_VERIFY_TOKEN.
 *   POST events: message statuses (sent / delivered / read / failed) and incoming messages.
 *        Authenticated with X-Hub-Signature-256 = HMAC-SHA256(raw body, WHATSAPP_APP_SECRET).
 *        Always answered 200 quickly (Meta retries otherwise); events are only logged for now.
 */
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return res.status(200).type("text/plain").send(String(challenge || ""));
  }
  return res.sendStatus(403);
});

function validSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // never accept unsigned events in production
  const header = req.get("X-Hub-Signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.body || Buffer.alloc(0)).digest("hex");
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post("/", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  if (!validSignature(req)) {
    console.warn("[whatsapp:webhook] signature invalide — événement ignoré");
    return res.sendStatus(401);
  }
  res.sendStatus(200); // acknowledge first, then process

  let payload;
  try { payload = JSON.parse(req.body.toString("utf8")); } catch (e) { return; }
  (payload.entry || []).forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      const v = change.value || {};
      (v.statuses || []).forEach((st) => {
        if (st.status === "failed") {
          const err = (st.errors && st.errors[0]) || {};
          console.warn(`[whatsapp:webhook] échec d'envoi vers ${st.recipient_id} : ${err.code || ""} ${err.title || err.message || ""}`.trim());
        } else {
          console.log(`[whatsapp:webhook] message ${st.id} → ${st.recipient_id} : ${st.status}`);
        }
      });
      (v.messages || []).forEach((m) => {
        console.log(`[whatsapp:webhook] message reçu de ${m.from} (${m.type})`);
      });
    });
  });
});

module.exports = router;
