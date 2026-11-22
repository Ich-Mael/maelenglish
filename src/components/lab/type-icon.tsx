import { AudioLines, Blocks, Ear, FileSearch, Headphones, Keyboard, PenLine, Speech, SpellCheck, Link2, MessagesSquare, Mic, TextCursorInput, type LucideIcon } from "lucide-react";
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
  "repeat_after": Speech,
  "writing_task": PenLine,
  "dictation": Keyboard,
  "role_play": MessagesSquare,
  "speaking_challenge": Mic,
};
