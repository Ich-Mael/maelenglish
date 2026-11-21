import { AccountError } from "@/lib/auth/accounts";

export class AdminError extends Error {}

/** Staff-facing (English) message for expected failures (validation, rules); rethrows the rest. */
export function errorMessage(e: unknown): string {
  if (e instanceof AdminError || e instanceof AccountError) return e.message;
  if (e && typeof e === "object" && (e as { name?: string }).name === "ValidationError") {
    const errors = Object.values((e as { errors: Record<string, { message: string }> }).errors);
    return errors[0]?.message ?? "Invalid data.";
  }
  if (e && typeof e === "object" && (e as { code?: number }).code === 11000) return "This item already exists.";
  if (e && typeof e === "object" && (e as { name?: string }).name === "CastError") return "Invalid ID.";
  throw e;
}
