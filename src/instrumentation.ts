/** Runs once when the server starts (see instrumentation-node.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // `next build` loads this file too
  const { checkConfig } = await import("./instrumentation-node");
  checkConfig();
  // Daily coach digest (src/lib/notifications.ts): production server, or DIGEST_SCHEDULER=on to try it locally.
  if (process.env.NODE_ENV === "production" || process.env.DIGEST_SCHEDULER === "on") {
    const { startDigestScheduler } = await import("./lib/notifications");
    startDigestScheduler();
  }
}
