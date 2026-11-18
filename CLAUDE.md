@AGENTS.md

# CLAUDE.md

**MaelEnglish** — interactive, gamified English learning platform (slogan « Speak the Language of Your Profession »). Being **rewritten** from the old AfroHK Express/EJS app into Next.js. All UI text is in **French**.

## Commands

```bash
npm run dev     # Next.js dev server (http://localhost:3000)
npm run build   # production build — must pass before committing
npm run lint    # ESLint — must pass before committing
npm start       # serve the production build
```

No test suite yet.

## Stack

Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS 4 + shadcn/ui (`components.json`, style base-nova, icons lucide), Mongoose (`src/lib/db.ts` → `connectDB()`, cached on `globalThis`, server-only). Planned: Motion, Rive / canvas-confetti / Howler (gamification feedback), dnd-kit + MediaRecorder (exercises), TanStack Query + Zustand, Better Auth, PWA. Hosting: Render (`render.yaml`, Node 22).

Next.js 16 differs from older versions — read `node_modules/next/dist/docs/` before using an API you're unsure about (see `AGENTS.md`).

## Brand

Tokens in `src/app/globals.css`: shadcn variables mapped to the brand (`primary` = blue #364fab, `accent` = coral) plus Tailwind colours `coral`, `coral-dark`, `coral-soft`, `brand`, `brand-dark`, `brand-deep`, `brand-soft`, `ink`, `success`, `xp`. Fonts (`next/font`): **Archivo** for headings (`font-heading`, applied to h1–h4), **Outfit** for body (`font-sans`). Images in `public/images/` (logos `maelenglish-logo*`, `-light` for dark backgrounds, OG image `maelenglish-og.jpg`) and `public/images/photos/<name>-{720,1280}.webp` + `-1280.jpg` (programme photos).

## Rewrite status

- `legacy/` = the old Express/EJS MaelEnglish app, **read-only reference** while porting (models, `catalog.js`, account/WhatsApp/notification flows, course engine). `legacy/CLAUDE.md` documents it in detail. Never run or import it from the new app; it is deleted at the end of the rewrite.
- E-Kalan, Institution and the AfroHK pages were removed and are not to be ported.
- URLs live at the root (`/`, `/programmes/[slug]`, `/coaching`, `/cours/...`); no redirects from the old `/maelenglish/*` URLs (the app had no users).
- Uses a **new, separate MongoDB database** (`APP_DB`), never the AfroHK one.
- Phases: 0 scaffold ✅ → 1 models & catalogue → 2 auth → 3 public site → 4 learner app & exercises → 5 gamification → 6 admin & instructor → 7 PWA & polish → 8 delete `legacy/`, deploy.

## Environment

See `.env.example`. Required: `APP_DB`, `SECRET`, `APP_URL`. Email via Brevo SMTP (`EMAIL_*`), WhatsApp Cloud API (`WHATSAPP_*`, simulation mode without token).
