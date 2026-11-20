import { FileText, PlayCircle, Sparkles, Type } from "lucide-react";

/** Lesson (activity) types: label and icon in admin lists. */
export const LESSON_TYPE = {
  video: { label: "Vidéo", icon: PlayCircle },
  text: { label: "Texte", icon: Type },
  pdf: { label: "PDF", icon: FileText },
  practice: { label: "Pratique", icon: Sparkles },
} as const;
