/*
 * Payment providers. CinetPay (checkout API v2: Orange Money, Moov Money, Wave, cards) when
 * `CINETPAY_API_KEY` and `CINETPAY_SITE_ID` are set; a simulated checkout outside production
 * (development and tests: a local page where you choose « paid » or « refused »); none in
 * production without keys (the Shop says payments aren't available).
 *
 * Trust rule: a payment counts only after a server-to-server `check` with the provider (never
 * because the browser came back to the return URL or a notification arrived) — and only when the
 * amount and currency match what we asked for.
 *
 * CinetPay API reference: https://docs.cinetpay.com (checkout « initialisation » and
 * « vérification »). Verify the field names against your merchant dashboard's test payments
 * when the keys are set.
 */

export type InitInput = {
  transactionId: string;
  amount: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  customer: { id: string; name: string; surname: string; email: string; phone: string };
};
export type CheckResult = { status: "paid" | "failed" | "pending"; amount: number | null; currency: string; method: string; providerRef: string; message: string };

export interface PaymentProvider {
  readonly name: string;
  init(p: InitInput): Promise<{ paymentUrl: string; token: string }>;
  check(transactionId: string): Promise<CheckResult>;
}

const API = "https://api-checkout.cinetpay.com/v2";

/** CinetPay wants plain descriptions (no #, /, $, _, &…). */
export const cleanDescription = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 .,'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "MaelEnglish";

export class CinetPayProvider implements PaymentProvider {
  readonly name = "cinetpay";
  constructor(
    private apiKey: string,
    private siteId: string,
  ) {}

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apikey: this.apiKey, site_id: this.siteId, ...body }), signal: AbortSignal.timeout(20_000) });
    const json = (await res.json().catch(() => null)) as T | null;
    if (!json) throw new Error(`CinetPay ${res.status}`);
    return json;
  }

  async init(p: InitInput) {
    const r = await this.post<{ code: string; message: string; description?: string; data?: { payment_url?: string; payment_token?: string } }>("/payment", {
      transaction_id: p.transactionId,
      amount: p.amount,
      currency: "XOF",
      description: cleanDescription(p.description),
      notify_url: p.notifyUrl,
      return_url: p.returnUrl,
      channels: "ALL",
      lang: "fr",
      metadata: p.customer.id,
      customer_id: p.customer.id,
      customer_name: p.customer.name || "Client",
      customer_surname: p.customer.surname || "MaelEnglish",
      customer_email: p.customer.email || undefined,
      customer_phone_number: p.customer.phone || undefined,
      // Card payments ask for an address; mobile money doesn't use it.
      customer_address: "Ouagadougou",
      customer_city: "Ouagadougou",
      customer_country: "BF",
      customer_state: "BF",
      customer_zip_code: "00000",
    });
    if (r.code !== "201" || !r.data?.payment_url) throw new Error(`CinetPay: ${r.message}${r.description ? ` (${r.description})` : ""}`);
    return { paymentUrl: r.data.payment_url, token: r.data.payment_token ?? "" };
  }

  async check(transactionId: string): Promise<CheckResult> {
    const r = await this.post<{ code: string; message: string; data?: { status?: string; amount?: string | number; currency?: string; payment_method?: string; operator_id?: string } }>("/payment/check", { transaction_id: transactionId });
    const d = r.data ?? {};
    const status = r.code === "00" && d.status === "ACCEPTED" ? "paid" : d.status === "REFUSED" || r.code === "600" || r.code === "627" ? "failed" : "pending";
    return { status, amount: d.amount != null ? Number(d.amount) : null, currency: d.currency ?? "", method: d.payment_method ?? "", providerRef: d.operator_id ?? "", message: r.message ?? "" };
  }
}

/** Development / tests: the « checkout » is a local page; the outcome is stored on the payment. */
export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulation";
  constructor(private lookup: (transactionId: string) => Promise<{ simStatus: string; amount: number } | null>) {}
  async init(p: InitInput) {
    return { paymentUrl: `/paiement/simulation/${p.transactionId}`, token: `sim_${p.transactionId}` };
  }
  async check(transactionId: string): Promise<CheckResult> {
    const p = await this.lookup(transactionId);
    const status = p?.simStatus === "paid" ? "paid" : p?.simStatus === "failed" ? "failed" : "pending";
    return { status, amount: p?.amount ?? null, currency: "XOF", method: status === "paid" ? "SIMULATION" : "", providerRef: "", message: "simulation" };
  }
}

export const isCinetPayConfigured = () => !!(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
