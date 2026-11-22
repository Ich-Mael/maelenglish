import {
  AudioLines, Award, BadgeCheck, Blocks, BookOpen, CalendarCheck, Crown, Diamond, Ear, Eye, Feather, Flame, Footprints, Gem, Goal, GraduationCap, Headphones, Library, Mail, Medal, Megaphone, Mic, Mountain, PenLine, Puzzle, RefreshCw, Rocket, Route, Sparkles, Speech, Star, Target, Trophy, Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeIcon as BadgeIconName } from "@/lib/gamification/rules";

const ICONS: Record<BadgeIconName, LucideIcon> = {
  Footprints, Route, Library, Mountain, GraduationCap, Flame, Zap, CalendarCheck, Crown, Goal, Medal, Headphones, Ear, AudioLines, Puzzle, Blocks, PenLine, BookOpen, Eye, Mail, Feather, Mic, Trophy, Megaphone, BadgeCheck, Award, Speech, Target, Gem, Diamond, RefreshCw, Star, Sparkles, Rocket,
};

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as BadgeIconName] ?? Star;
  return <Icon className={className} aria-hidden />;
}
