/*
 * Live coaching sessions: embedded video calls by Daily (Daily Prebuilt — camera, microphone,
 * screen sharing, chat). Server-only: the API key never reaches the browser, which only gets a
 * room URL and a short meeting token. One private room per session, expiring after it; the coach
 * joins as owner (can mute / remove, end the call). Without `DAILY_API_KEY` the session falls back
 * to the coaching's own meeting link (Zoom / Google Meet), if any.
 */

const API = "https://api.daily.co/v1";

export type RoomInfo = { name: string; url: string };
export interface VideoProvider {
  readonly name: string;
  room(name: string, opts: { expiresAt: Date; maxParticipants: number }): Promise<RoomInfo>;
  token(room: string, opts: { userId: string; userName: string; owner: boolean; expiresAt: Date }): Promise<string>;
}

export const isDailyConfigured = () => !!process.env.DAILY_API_KEY;

async function call<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Daily ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return (await res.json()) as T;
}

export class DailyProvider implements VideoProvider {
  readonly name = "daily";
  async room(name: string, opts: { expiresAt: Date; maxParticipants: number }): Promise<RoomInfo> {
    const exp = Math.floor(opts.expiresAt.getTime() / 1000);
    // Already created (another participant joined first): reuse it.
    try {
      const r = await call<{ name: string; url: string }>(`/rooms/${encodeURIComponent(name)}`, null, "GET");
      return { name: r.name, url: r.url };
    } catch {
      /* not found: create it */
    }
    const r = await call<{ name: string; url: string }>("/rooms", {
      name,
      privacy: "private",
      properties: { exp, eject_at_room_exp: true, max_participants: Math.max(2, Math.min(50, opts.maxParticipants)), enable_screenshare: true, enable_chat: true, enable_prejoin_ui: true, enable_knocking: false, lang: "en" },
    });
    return { name: r.name, url: r.url };
  }
  async token(room: string, opts: { userId: string; userName: string; owner: boolean; expiresAt: Date }): Promise<string> {
    const r = await call<{ token: string }>("/meeting-tokens", {
      properties: { room_name: room, user_id: opts.userId, user_name: opts.userName.slice(0, 60), is_owner: opts.owner, exp: Math.floor(opts.expiresAt.getTime() / 1000), enable_screenshare: true },
    });
    return r.token;
  }
}

/** Deterministic fake (tests). */
export class FakeVideoProvider implements VideoProvider {
  readonly name = "fake";
  rooms = new Map<string, RoomInfo>();
  async room(name: string): Promise<RoomInfo> {
    const r = this.rooms.get(name) ?? { name, url: `https://fake.daily.co/${name}` };
    this.rooms.set(name, r);
    return r;
  }
  async token(room: string, opts: { userId: string; owner: boolean }) {
    return `tok_${room}_${opts.userId}_${opts.owner ? "owner" : "guest"}`;
  }
}

let override: VideoProvider | null | undefined;
export const setVideoProviderForTests = (p: VideoProvider | null | undefined) => {
  override = p;
};
/** Daily when configured, else null (sessions use the coaching's meeting link). */
export function videoProvider(): VideoProvider | null {
  if (override !== undefined) return override;
  return isDailyConfigured() ? new DailyProvider() : null;
}
