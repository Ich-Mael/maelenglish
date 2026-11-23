import * as z from "zod/v4";

/** The diagnostic report (DIAGNOSTIC_SPEC.md §7), as the AI must return it. Shared by browser and server. */
export const DiagnosticReportSchema = z.object({
  headline: z.string(),
  profile_name: z.string(),
  profile_summary: z.string(),
  what_holds_you_back: z.array(z.object({ title: z.string(), explanation: z.string() })).min(2).max(3),
  reframe: z.string(),
  your_strengths: z.array(z.string()).min(2).max(3),
  recommended_method: z.array(z.object({ title: z.string(), description: z.string() })).length(3),
  first_step_this_week: z.string(),
  goal_reminder: z.string(),
});
export type DiagnosticReport = z.infer<typeof DiagnosticReportSchema>;
