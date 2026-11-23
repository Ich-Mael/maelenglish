# Story Mode — video-game look and guide character (plan for later)

Status: **not started** — owner request 2026-11-23 (« put this as a plan for later »).
Goal: Story Mode scenes and in-episode moments should feel like a video game / visual novel,
not chat bubbles on a white page.

## 1. Guide character (« guide moments »)

A character pops up at key moments of an episode with a speech bubble, like in video games.

- **Look**: a big avatar slides in from the bottom corner (bottom sheet on phones), the page behind
  is dimmed, the text types itself out while the character's voice plays (ElevenLabs, cached like
  scene lines). « Tap to continue » for the next line, « Skip » closes.
- **Who speaks**: any season character, or a recurring guide (Coach Ish — his portrait, his cloned
  voice once it exists). To decide: default guide = Coach Ish or a season character.
- **Triggers** (all optional, written per episode):
  - opening the Video step;
  - opening Learn & practise (« Watch out for the verb to be… »);
  - just before the conversation (« Officer Asante will ask for your name… »);
  - after a failed call (encouragement) / a passed call (congratulations);
  - coming back after several days away (« Welcome back! Last time… »).
- **Shown once** per learner, then available again behind a small « ? » in the corner of the step.
- **Admin**: a « Guide moments » section in the episode editor: per trigger, the character and the
  lines (reuse `SceneEditor`: English + French translation, or French narration, ▶ voice preview).
- **Data**: `StoryEpisode.content.guide_moments: { trigger, lines: SceneLine[] }[]`; seen moments
  stored on `EpisodeProgress` (e.g. `guideSeen: string[]`).
- **No AI minutes** used (voices generated once and cached in R2).
- **Lighter variants**, if needed first: (a) tips only — a small bubble with the character's head
  next to an element, no voice; (b) later, interactive scenes — the learner picks a reply in the
  bubble and the character reacts.

## 2. Game-style scenes (intro, outro, guide moments)

Three layers:

1. **Setting**
   - one background illustration per place, shown full-bleed, darkened at the bottom for readability;
   - a title card when entering a place (« Kotoka Airport · Day 1 · 9:12 ») with a fade;
   - optional quiet ambient sound per place (off by default — data costs).
2. **Characters**
   - large illustrated busts (waist up) in front of the background; the one entering slides in;
     the speaker is lit and moves slightly with their voice (like Coach Ish's portrait in calls),
     the other is dimmed;
   - 3–4 expressions per character (neutral, smiling, surprised, thinking), picked per line.
3. **Dialogue box** (bottom)
   - name plate in brand colours, typewriter text synced with the voice, blinking « ▼ » to
     continue, « Translate », « Skip », tap to speed up;
   - phones: background top two-thirds, character in the middle, box at the bottom (portrait).

### Assets needed from the owner (same illustrated style as the Accra cover)

| Element | Format | Season 1 |
|---|---|---|
| Place backgrounds | 16:9 (ideally 1920×1080), no text, no characters | 7 places |
| Character portraits | waist-up bust, transparent PNG, ~1000 px tall | 4 characters × 3–4 expressions ≈ 14 |
| Ambient sounds (optional) | MP3 loop 20–30 s | 1 per place |

Converted to WebP (~150–250 KB per background), loaded only when needed (low-end phones, data).

### Learner's own character — to decide

- **Recommended**: the learner never appears in full; their lines show with their small builder
  avatar in the dialogue box.
- Later: an illustrated avatar from their photo (spec « V2 »: consent, photo deleted after
  generation), in the same style as the cast.

### What to build

- Admin: background picture per place (« Places & map » tab); expression pictures per character
  (« Cast » tab); an « expression » choice per line in `SceneEditor`.
- Learner: a full-screen « scene stage » player used by intros, outros and guide moments
  (replaces the current `SceneView` bubbles); reduced-motion support; works without the images
  (falls back to today's look).
- Optional first step: a prototype using the Accra cover as the airport background and the current
  SVG avatars in place of the portraits.
