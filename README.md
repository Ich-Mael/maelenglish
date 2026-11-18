# MaelEnglish

**Speak the Language of Your Profession** — interactive English learning platform by Coach Ish (Ismaël Zerbo): general English and English for professions (aviation, business, health, tech, finance…), with gamified practice, graded quizzes, coach-corrected assignments, and an installable, offline-capable app.

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MongoDB (Mongoose) · hosted on Render.

## Run locally

```bash
npm install
cp .env.example .env.local   # set APP_DB to a MaelEnglish database, APP_URL=http://localhost:3001
npm run seed:demo            # optional demo data — accounts demo / demo-coach / demo-admin, password « anglais2026 »
npm run dev                  # http://localhost:3001
```

First time on an empty database: open `/installation` to create the first administrator.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Deploy

Render Blueprint in `render.yaml` (health check `/api/health`). Set the secrets (`APP_DB`, `APP_URL`, `EMAIL_*`, `WHATSAPP_*`) in the Render dashboard.

Developer documentation: [`CLAUDE.md`](CLAUDE.md).
