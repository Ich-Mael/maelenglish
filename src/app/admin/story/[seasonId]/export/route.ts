import { readCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/admin/permissions";
import { connectDB } from "@/lib/db";
import { exportSeason, StoryAdminError } from "@/lib/story/admin";

/** The season as a JSON file (backup, or to edit / draft episodes outside the app). */
export async function GET(_: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  const me = await readCurrentUser();
  if (!me || !can.editStory({ id: me.id, role: me.role })) return new Response("Forbidden", { status: 403 });
  await connectDB();
  try {
    const file = await exportSeason((await params).seasonId);
    return new Response(JSON.stringify(file, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="story-${file.slug}.json"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof StoryAdminError) return new Response(e.message, { status: 404 });
    throw e;
  }
}
