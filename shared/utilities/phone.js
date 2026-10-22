/**
 * Phone numbers → international digits without "+" (the format the WhatsApp Cloud API expects).
 *
 *   "+226 70 12 34 56" → "22670123456"     "0022670123456" → "22670123456"
 *   "70 12 34 56"      → "22670123456"     (local number: WHATSAPP_DEFAULT_COUNTRY_CODE, default 226)
 *
 * Returns null when the input cannot be a phone number (fewer than 8 or more than 15 digits).
 */
function defaultCountryCode() {
  return String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "226").replace(/\D/g, "");
}

function normalizePhone(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const international = s.startsWith("+") || s.startsWith("00");
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("00")) digits = digits.slice(2);
  if (!international) {
    // a local number (≤ 10 digits, possibly with a trunk 0) gets the default country code
    if (digits.length <= 10) digits = defaultCountryCode() + digits.replace(/^0+/, "");
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

// "22670123456" → "+226 70 12 34 56" style display (best effort)
function displayPhone(e164) {
  if (!e164) return "";
  const cc = defaultCountryCode();
  if (e164.startsWith(cc)) return "+" + cc + " " + e164.slice(cc.length).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return "+" + e164;
}

// Does a login / search identifier look like a phone number rather than a username or email?
function looksLikePhone(s) {
  if (!s) return false;
  const t = String(s).trim();
  return /^[+0-9][0-9 ().-]{6,}$/.test(t) && t.replace(/\D/g, "").length >= 8;
}

module.exports = { normalizePhone, displayPhone, looksLikePhone, defaultCountryCode };
