import { AudioLines, Blocks, Ear, FileSearch, Headphones, SpellCheck, Link2, Mic, TextCursorInput, type LucideIcon } from "lucide-react";
import type { ActivityType } from "@/lib/lab/types";

/** Icon per Labo activity type. */
export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  "listen_choose": Headphones,
  "fill_gaps": TextCursorInput,
  "listen_fill_gaps": AudioLines,
  "sentence_builder": Blocks,
  "match_pairs": Link2,
  "listen_match": Ear,
  "true_false_ng": FileSearch,
  "complete_words": SpellCheck,
  "speaking_challenge": Mic,
};
