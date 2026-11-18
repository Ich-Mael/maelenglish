import { AccountError } from "@/lib/auth/accounts";

export class AdminError extends Error {}

/** French message for expected failures (validation, rules); rethrows the rest. */
export function errorMessage(e: unknown): string {
  if (e instanceof AdminError || e instanceof AccountError) return e.message;
  if (e && typeof e === "object" && (e as { name?: string }).name === "ValidationError") {
    const errors = Object.values((e as { errors: Record<string, { message: string }> }).errors);
    return errors[0]?.message ?? "Données invalides.";
  }
  if (e && typeof e === "object" && (e as { code?: number }).code === 11000) return "Cet élément existe déjà.";
  if (e && typeof e === "object" && (e as { name?: string }).name === "CastError") return "Identifiant invalide.";
  throw e;
}
