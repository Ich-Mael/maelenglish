import { BookOpen, Crown, Flame, Footprints, Gem, GraduationCap, Library, PenLine, Sparkles, Star, Target, Trophy, Zap, type LucideIcon } from "lucide-react";
import type { BadgeIcon as BadgeIconName } from "@/lib/gamification/rules";

const ICONS: Record<BadgeIconName, LucideIcon> = { Footprints, BookOpen, Library, Flame, Zap, Crown, Target, Star, Trophy, GraduationCap, PenLine, Sparkles, Gem };

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as BadgeIconName] ?? Star;
  return <Icon className={className} aria-hidden />;
}
