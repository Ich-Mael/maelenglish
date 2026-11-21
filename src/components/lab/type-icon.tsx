import { Headphones, Mic, type LucideIcon } from "lucide-react";
import type { ActivityType } from "@/lib/lab/types";

/** Icon per Labo activity type. */
export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  "listen_choose": Headphones,
  "speaking_challenge": Mic,
};
