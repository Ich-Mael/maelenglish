"use client";

/**
 * Lesson steps completed offline (« Continuer »), kept on the device (localStorage) and sent
 * when the connection comes back (OfflineSync). Cleared at logout.
 */
export type QueuedItem = { id: string; kind: "complete"; courseId: string; stepId: string; at: number };

const KEY = "me-offline-queue";
type NewItem = QueuedItem extends infer T ? (T extends QueuedItem ? Omit<T, "id" | "at"> : never) : never;

export function readQueue(): QueuedItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedItem[];
  } catch {
    return [];
  }
}

function write(items: QueuedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked */
  }
  window.dispatchEvent(new Event("me-queue"));
}

export function enqueue(item: NewItem) {
  // One entry per step.
  const rest = readQueue().filter((q) => !(q.stepId === item.stepId && q.kind === item.kind));
  write([...rest, { ...item, id: Math.random().toString(36).slice(2), at: Date.now() } as QueuedItem]);
}

export function removeFromQueue(id: string) {
  write(readQueue().filter((q) => q.id !== id));
}

export function clearQueue() {
  write([]);
}

/** A server action call that failed because the device is offline (not a server-side refusal). */
export function isOfflineError(e: unknown): boolean {
  return typeof navigator !== "undefined" && (!navigator.onLine || (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)));
}
