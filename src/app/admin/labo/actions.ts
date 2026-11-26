"use server";

import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { actorOf, allowed, staffOrThrow } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { AdminError, errorMessage } from "@/lib/admin/errors";
import * as lab from "@/lib/lab/service";
import { Activity, Course, Step, Unit, type ActivityDoc, type CourseDoc } from "@/models";
import { previewCorrection, WritingError } from "@/lib/lab/writing";
import { LabTtsError, generateModelAudio } from "@/lib/lab/tts";
import type { WritingTaskContent } from "@/lib/lab/types";
import type { WritingCorrection } from "@/lib/ai";
import type { CurrentUser } from "@/lib/auth/dal";

type State = { error?: string; success?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (e: unknown): State => ({ error: errorMessage(e) });

async function labUser() {
  const me = await staffOrThrow();
  if (!can.useLab(actorOf(me))) throw new AdminError("The Lab is for instructors, coaches and administrators.");
  return me;
}

/** The unit (and its course), if the staff member may edit that course's content. */
async function editableUnit(me: CurrentUser, unitId: string) {
  const u = Types.ObjectId.isValid(unitId) ? await Unit.findById(unitId).select("courseId moduleId").lean() : null;
  if (!u) throw new AdminError("Unit not found.");
  const course = await Course.findById(u.courseId).lean<CourseDoc>();
  if (!course || !allowed(me, course, "edit")) throw new AdminError("You don't have rights on this course.");
  return { unit: u, course };
}

/** New activity; with `unitId`, it is added to that unit straight away. Opens its page. */
export async function createActivityAction(_: State, form: FormData): Promise<State> {
  let target: string;
  try {
    const me = await labUser();
    const unitId = str(form, "unitId");
    if (unitId) await editableUnit(me, unitId);
    const a = await lab.createActivity(str(form, "type"), str(form, "title"), me.id);
    if (unitId) await lab.attachActivity(String(a._id), unitId);
    target = `/admin/labo/${a._id}${unitId ? `?unite=${unitId}` : ""}`;
  } catch (e) {
    return fail(e);
  }
  redirect(target);
}

export async function saveActivityAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await labUser();
    // Type-specific fields are named « c_<field> » by the editors (components/lab/editors.tsx).
    const content: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (k.startsWith("c_") && typeof v === "string") content[k.slice(2)] = v;
    await lab.updateActivity(
      str(form, "activityId"),
      {
        title: str(form, "title"),
        level: str(form, "level"),
        skills: form.getAll("skills").map(String),
        theme: str(form, "theme"),
        durationMin: str(form, "durationMin"),
        instructions: str(form, "instructions"),
        maelTip: str(form, "maelTip"),
        tags: str(form, "tags").split(","),
        ready: form.get("ready") === "on",
        content,
      },
      me.id,
    );
    refresh();
    return { success: form.get("ready") === "on" ? "Activity saved (ready)." : "Draft saved: learners can't see it yet." };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateActivityAction(_: State, form: FormData): Promise<State> {
  let target: string;
  try {
    const me = await labUser();
    const copy = await lab.duplicateActivity(str(form, "activityId"), me.id);
    target = `/admin/labo/${copy._id}`;
  } catch (e) {
    return fail(e);
  }
  redirect(target);
}

export async function deleteActivityAction(_: State, form: FormData): Promise<State> {
  try {
    await labUser();
    await lab.deleteActivity(str(form, "activityId"));
  } catch (e) {
    return fail(e);
  }
  redirect("/admin/labo");
}

export async function attachActivityAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await labUser();
    const unitId = str(form, "unitId");
    await editableUnit(me, unitId);
    const role = await lab.attachActivity(str(form, "activityId"), unitId);
    refresh();
    return { success: role === "challenge" ? "Unit speaking challenge set." : "Activity added before the unit's challenge, practising its last lesson." };
  } catch (e) {
    return fail(e);
  }
}

/** Removes an activity step or a unit challenge (from « Used in »). */
export async function removeStepAction(form: FormData) {
  const me = await labUser();
  const s = Types.ObjectId.isValid(str(form, "stepId")) ? await Step.findById(str(form, "stepId")).select("unitId").lean() : null;
  if (!s) throw new AdminError("Step not found.");
  await editableUnit(me, String(s.unitId));
  await lab.deleteStep(str(form, "stepId"));
  refresh();
}

/** Lab preview of a writing task: the AI draft the coach would get for this text (cost recorded on the staff member), nothing saved. */
export async function previewWritingAction(activityId: string, text: string): Promise<{ ok: true; correction: WritingCorrection } | { ok: false; error: string }> {
  try {
    const me = await labUser();
    const a = Types.ObjectId.isValid(activityId) ? await Activity.findById(activityId).lean<ActivityDoc>() : null;
    if (!a || a.type !== "writing_task") throw new AdminError("Activity not found.");
    const correction = await previewCorrection(me.id, { courseId: new Types.ObjectId(), stepId: new Types.ObjectId(), activityId: a._id, level: a.level ?? "", content: a.content as WritingTaskContent }, text);
    return { ok: true, correction };
  } catch (e) {
    return { ok: false, error: e instanceof WritingError ? e.message : errorMessage(e) };
  }
}

/** « Generate with ElevenLabs » in the Lab editors: the phrase read by the chosen voice → a model-audio Media. */
export async function generateModelAudioAction(text: string, voiceId: string): Promise<{ ok: true; mediaId: string; url: string } | { ok: false; error: string }> {
  try {
    const me = await labUser();
    const r = await generateModelAudio(me.id, String(text ?? ""), String(voiceId ?? ""));
    return { ok: true, mediaId: r.mediaId, url: r.url };
  } catch (e) {
    return { ok: false, error: e instanceof LabTtsError ? e.message : errorMessage(e) };
  }
}
