"use server";

import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { setDailyGoal } from "@/lib/gamification/service";
import { DAILY_GOALS } from "@/lib/gamification/rules";

export async function chooseDailyGoal(form: FormData) {
  const me = await readCurrentUser();
  if (!me) return;
  const goal = Number(form.get("goal"));
  if (!(DAILY_GOALS as readonly number[]).includes(goal)) return;
  await connectDB();
  await setDailyGoal(me.id, goal);
  refresh();
}
