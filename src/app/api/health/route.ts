import mongoose from "mongoose";
import { connection } from "next/server";
import { connectDB } from "@/lib/db";

const TIMEOUT_MS = 3000;
const headers = { "Cache-Control": "no-store" };

/** Render health check: 200 when the app and the database answer within 3 s, 503 otherwise. */
export async function GET() {
  await connection();
  try {
    await Promise.race([
      (async () => {
        await connectDB();
        await mongoose.connection.db?.admin().ping();
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ ok: false, error: "database" }, { status: 503, headers });
  }
}
