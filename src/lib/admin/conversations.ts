import { Types } from "mongoose";
import { ConversationSession, User } from "@/models";

/*
 * Coaches read their learners' AI role-plays (owner decision 2026-11-22: the learner sees the
 * debrief at once, their coach can read it). Admins see everyone's; english-coach / instructor
 * see the learners whose main coach they are (`User.coachId`). Framework-free.
 */

type Viewer = { id: string; isAdmin: boolean; role: string };

const canView = (v: Viewer) => v.isAdmin || v.role === "english-coach" || v.role === "instructor";

async function learnerFilter(v: Viewer): Promise<Record<string, unknown> | null> {
  if (!canView(v)) return null;
  if (v.isAdmin) return {};
  const mine = await User.find({ coachId: new Types.ObjectId(v.id) }).select("_id").lean();
  return { userId: { $in: mine.map((u) => u._id) } };
}

export async function listConversations(v: Viewer, opts: { limit?: number } = {}) {
  const f = await learnerFilter(v);
  if (!f) return [];
  const rows = await ConversationSession.find({ ...f, preview: false, status: { $in: ["ended", "debriefed"] } })
    .select("userId title difficulty score durationS status helpCount createdAt")
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 100)
    .lean();
  const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select("name surname username").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((r) => {
    const u = byId.get(String(r.userId));
    return { ...r, learner: u ? `${u.name} ${u.surname ?? ""}`.trim() : "—", username: u?.username ?? "" };
  });
}

export async function conversationFor(v: Viewer, sessionId: string) {
  if (!Types.ObjectId.isValid(sessionId)) return null;
  const f = await learnerFilter(v);
  if (!f) return null;
  const s = await ConversationSession.findOne({ _id: sessionId, ...f }).lean();
  if (!s) return null;
  const u = await User.findById(s.userId).select("name surname username").lean();
  return { session: s, learner: u ? `${u.name} ${u.surname ?? ""}`.trim() : "—", username: u?.username ?? "" };
}
