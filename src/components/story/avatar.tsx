import type { AvatarConfig } from "@/lib/story/schema";
import { DEFAULT_AVATAR } from "@/lib/story/avatar-defaults";

/*
 * Story Mode avatar (owner spec « Learner avatars », V1 builder): one flat illustrated style for the
 * learner and every character, drawn in SVG from the builder choices — no image files, works on
 * low-end phones, server- and client-safe. Palettes cover a wide range of African skin tones.
 */

export const SKIN = ["#f6d3b3", "#e8b48c", "#d39a6a", "#b97b4b", "#9a5f36", "#7a4627", "#5c331c", "#3f2314"];
export const HAIR_COLOR = ["#1b1410", "#3a2416", "#6b4226", "#a0703f", "#7d7d7d", "#c8462e"];
export const OUTFIT_COLOR = ["#364fab", "#1f2b5e", "#ff5757", "#12855a", "#e2a33b", "#7b4fb3", "#f2f2f2", "#2b2b2b"];
export const BG = ["#e8edfb", "#ffe3e3", "#fff2d6", "#dff3ea", "#efe6fb", "#e9eef2"];

export { DEFAULT_AVATAR };

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join("")}`;
};

function Hair({ a, color, back }: { a: AvatarConfig; color: string; back: boolean }) {
  const dark = shade(color, 0.8);
  switch (a.hair) {
    case "afro":
      return back ? <circle cx="60" cy="44" r="33" fill={color} /> : <path d="M33 46c0-18 12-28 27-28s27 10 27 28c-4-8-12-12-27-12S37 38 33 46z" fill={color} />;
    case "braids":
      return back ? (
        <g fill={color}>
          <path d="M34 44c-4 18-3 38 2 52h10l-2-50zM86 44c4 18 3 38-2 52H74l2-50z" />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={39 + (i % 2) * 2} cy={60 + i * 9} r="3" fill={dark} />)}
          {[0, 1, 2, 3].map((i) => <circle key={`r${i}`} cx={81 - (i % 2) * 2} cy={60 + i * 9} r="3" fill={dark} />)}
        </g>
      ) : (
        <path d="M34 48c0-17 11-27 26-27s26 10 26 27c-3-6-9-11-14-12l-12 5-12-5c-5 1-11 6-14 12z" fill={color} />
      );
    case "locs":
      return back ? (
        <g stroke={color} strokeWidth="6" strokeLinecap="round">
          {[36, 42, 48, 72, 78, 84].map((x, i) => <path key={x} d={`M${x} 40 v${40 + (i % 2) * 8}`} />)}
        </g>
      ) : (
        <path d="M34 48c0-17 11-27 26-27s26 10 26 27c-6-7-15-11-26-11S40 41 34 48z" fill={color} />
      );
    case "bun":
      return back ? <circle cx="60" cy="16" r="10" fill={color} /> : <path d="M35 47c0-16 11-26 25-26s25 10 25 26c-5-8-13-13-25-13S40 39 35 47z" fill={color} />;
    case "long":
      return back ? <path d="M33 46c-3 20-1 38 4 50h46c5-12 7-30 4-50z" fill={color} /> : <path d="M34 50c0-18 11-29 26-29s26 11 26 29c-7-10-15-15-26-15S41 40 34 50z" fill={color} />;
    case "headwrap":
      return back ? <path d="M60 10c14 0 20 6 22 14l-8 4z" fill={OUTFIT_COLOR[(a.outfitColor + 2) % 8]} /> : (
        <g>
          <path d="M32 46c0-20 12-32 28-32s28 12 28 32c-8-6-17-9-28-9s-20 3-28 9z" fill={OUTFIT_COLOR[(a.outfitColor + 2) % 8]} />
          <path d="M40 30c8-5 32-5 40 0" stroke={shade(OUTFIT_COLOR[(a.outfitColor + 2) % 8], 0.75)} strokeWidth="3" fill="none" />
        </g>
      );
    case "fade":
      return back ? null : <path d="M36 44c0-14 10-22 24-22s24 8 24 22c-3-4-6-6-8-6H44c-2 0-5 2-8 6z" fill={color} />;
    case "bald":
      return null;
    default:
      return back ? null : <path d="M35 46c0-16 11-25 25-25s25 9 25 25c-4-6-9-9-13-9-4 2-8 3-12 3s-8-1-12-3c-4 0-9 3-13 9z" fill={color} />;
  }
}

function Outfit({ a, color }: { a: AvatarConfig; color: string }) {
  const dark = shade(color, 0.78);
  const body = "M22 120c0-20 16-32 38-32s38 12 38 32z";
  switch (a.outfit) {
    case "blazer":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M50 90l10 14 10-14v30H50z" fill="#fff" />
          <path d="M50 90l10 16-6 14-8-28zM70 90l-10 16 6 14 8-28z" fill={dark} />
        </g>
      );
    case "dashiki":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M46 90q14 18 28 0l-4 10q-10 10-20 0z" fill={OUTFIT_COLOR[4]} />
          <path d="M40 104h40" stroke={OUTFIT_COLOR[4]} strokeWidth="3" strokeDasharray="4 3" />
        </g>
      );
    case "dress":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M48 90q12 10 24 0" stroke={dark} strokeWidth="3" fill="none" />
        </g>
      );
    case "polo":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M50 90l10 8 10-8-4 8-6 6-6-6z" fill={dark} />
        </g>
      );
    case "uniform":
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M56 92h8v28h-8z" fill={dark} />
          <rect x="70" y="100" width="12" height="6" rx="1" fill={OUTFIT_COLOR[4]} />
        </g>
      );
    default:
      return (
        <g>
          <path d={body} fill={color} />
          <path d="M50 90l10 12 10-12" stroke="#fff" strokeWidth="3" fill="none" />
        </g>
      );
  }
}

/** The avatar picture. `size` in px; `rounded` = circle crop with the background colour. */
export function Avatar({ config, size = 96, className, title }: { config?: Partial<AvatarConfig> | null; size?: number; className?: string; title?: string }) {
  const a: AvatarConfig = { ...DEFAULT_AVATAR, ...(config ?? {}) };
  const skin = SKIN[a.skin] ?? SKIN[4];
  const hair = HAIR_COLOR[a.hairColor] ?? HAIR_COLOR[0];
  const outfit = OUTFIT_COLOR[a.outfitColor] ?? OUTFIT_COLOR[0];
  const face = a.face === "round" ? { rx: 23, ry: 24 } : a.face === "square" ? { rx: 22, ry: 25 } : { rx: 21, ry: 26 };
  const skinDark = shade(skin, 0.85);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ borderRadius: "50%", flexShrink: 0 }} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g>
        <rect width="120" height="120" fill={BG[a.bg] ?? BG[0]} />
        <Hair a={a} color={hair} back />
        <Outfit a={a} color={outfit} />
        <path d="M52 76h16v14q-8 6-16 0z" fill={skinDark} />
        <ellipse cx="38" cy="54" rx="4" ry="6" fill={skin} />
        <ellipse cx="82" cy="54" rx="4" ry="6" fill={skin} />
        {a.face === "square" ? <rect x={60 - face.rx} y={52 - face.ry} width={face.rx * 2} height={face.ry * 2} rx="16" fill={skin} /> : <ellipse cx="60" cy="52" rx={face.rx} ry={face.ry} fill={skin} />}
        {a.earrings ? (
          <g fill={OUTFIT_COLOR[4]}>
            <circle cx="38" cy="62" r="2.6" />
            <circle cx="82" cy="62" r="2.6" />
          </g>
        ) : null}
        <Hair a={a} color={hair} back={false} />
        <path d="M47 46q4-3 8 0M65 46q4-3 8 0" stroke={shade(hair, 0.9)} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <ellipse cx="51" cy="53" rx="2.6" ry="3" fill="#1b1410" />
        <ellipse cx="69" cy="53" rx="2.6" ry="3" fill="#1b1410" />
        <path d="M58 58q2 4 4 0" stroke={skinDark} strokeWidth="2" fill="none" strokeLinecap="round" />
        {a.beard === "full" ? <path d={`M${60 - face.rx + 2} 56q2 22 ${face.rx - 2} 23q${face.rx - 4} -1 ${face.rx - 2} -23q-4 10 -${face.rx - 2} 11q-${face.rx - 6} -1 -${face.rx - 2} -11z`} fill={hair} /> : a.beard === "short" ? <path d="M48 66q12 10 24 0q-2 8-12 9q-10-1-12-9z" fill={hair} opacity="0.85" /> : null}
        <path d="M53 67q7 5 14 0" stroke="#7a2a22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {a.glasses ? (
          <g stroke="#1b1410" strokeWidth="2" fill="rgb(255 255 255 / 0.25)">
            <rect x="43" y="47" width="15" height="11" rx="4" />
            <rect x="62" y="47" width="15" height="11" rx="4" />
            <path d="M58 52h4" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
