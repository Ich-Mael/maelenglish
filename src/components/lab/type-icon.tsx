import { AudioLines, Blocks, Headphones, Mic, TextCursorInput, type LucideIcon } from "lucide-react";
import type { ActivityType } from "@/lib/lab/types";

/** Icon per Labo activity type. */
export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  "listen_choose": Headphones,
  "fill_gaps": TextCursorInput,
  "listen_fill_gaps": AudioLines,
  "sentence_builder": Blocks,
  "speaking_challenge": Mic,
};
