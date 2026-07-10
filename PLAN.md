# Coach App — Multi-User Rebuild Plan

> Goal: Transform the single-user gym logger into a proper multi-user AI-driven gym app with installable PWA, PostgreSQL backend, and per-user data isolation.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 App Router | Keep existing, no reason to change |
| Language | TypeScript throughout | Already the case |
| Database | PostgreSQL 16 | Production-grade, JSONB for flexible schema |
| ORM | Drizzle ORM | TypeScript-first, App Router native, zero-overhead |
| Auth | Auth.js v5 (NextAuth) | Self-hosted, Drizzle adapter, email/password + OAuth |
| Styling | Tailwind CSS | Keep existing |
| AI | OpenRouter → Gemini Flash | Keep existing |
| Deployment | Docker Compose | App + DB in one stack |
| Mobile | PWA + PWABuilder APK | Installable, no separate codebase |

---

## Phase 1 — Foundation (estimated 3–4 weeks)

### 1.1 Database Setup
- [ ] Write Drizzle schema (`apps/web/lib/db/schema.ts`)
- [ ] Configure `drizzle.config.ts`
- [ ] Docker Compose: PostgreSQL 16 service with health check
- [ ] Dockerfile for Next.js app (standalone output)
- [ ] `.env.example` with all required variables
- [ ] Run `drizzle-kit generate` → create SQL migrations
- [ ] Apply migrations on first boot

### 1.2 Authentication
- [ ] Install Auth.js v5 + Drizzle adapter + bcryptjs
- [ ] Configure NextAuth with Credentials provider (email/password)
- [ ] JWT strategy (edge-compatible)
- [ ] Middleware: protect all routes except `/login`, `/register`, `/api/auth`
- [ ] Login page (`/login`)
- [ ] Register page (`/register`) — email, name, password
- [ ] User session accessible from server components via `auth()`

### 1.3 Data Access Layer Rewrite
Replace every function in `lib/data.ts` and `lib/ai-coach.ts` to query
PostgreSQL instead of reading JSON files. Every query scoped to `userId`.

**Functions to migrate:**
- [ ] `readMesocycle(userId)` — query `mesocycles` table
- [ ] `getAllGymSessions(userId)` — query `gym_sessions` + exercises + sets
- [ ] `getGymDayData(userId, date, type)` — same, with mesocycle fallback
- [ ] `getExerciseHistory(userId, name)` — join sessions → exercises → sets
- [ ] `readSettings(userId)` — query `user_settings`
- [ ] `writeSettings(userId, patch)` — upsert `user_settings`
- [ ] `getWeightOverrides(userId)` — query `weight_overrides`
- [ ] `saveWeightOverrides(userId, overrides)` — upsert per exercise
- [ ] `getSessionAnalysis(userId, date)` — query `ai_analyses`
- [ ] `saveSessionAnalysis(userId, analysis)` — insert `ai_analyses`
- [ ] `getSessionBriefing(userId, date)` — query `ai_briefings`
- [ ] `briefSession(userId, date, name)` — insert `ai_briefings`
- [ ] `generateNextMesocycle(userId)` — read + write mesocycles
- [ ] `deleteGymSession(userId, date)` — delete from `gym_sessions` (cascades)
- [ ] `readExerciseCatalog(userId)` — global + user-specific exercises

### 1.4 API Route Updates
Every API route reads `userId` from the session (via `auth()`), passes it down.
No route can access another user's data.

- [ ] `POST/GET /api/gym/[date]` — scoped to user
- [ ] `DELETE /api/gym/[date]` — scoped to user
- [ ] `POST/GET /api/ai/analyze-session` — scoped to user
- [ ] `POST /api/ai/brief-session` — scoped to user
- [ ] `GET/POST /api/ai/mesocycle` — scoped to user
- [ ] `GET/PUT /api/settings` — scoped to user
- [ ] `DELETE /api/settings/weight-overrides` — scoped to user

### 1.5 Data Migration
- [ ] Write `scripts/migrate-json.ts` — reads existing JSON files, inserts into DB
- [ ] Migrates: mesocycle, all sessions (exercises + sets), settings, weight overrides, AI analyses, AI briefings
- [ ] Idempotent (safe to run twice)
- [ ] Creates Sacha's user account if not exists

---

## Phase 2 — PWA + Core UX (estimated 1–2 weeks)

### 2.1 PWA
- [ ] `public/manifest.json` — name, icons, theme_color, display: standalone
- [ ] App icons (192×192, 512×512, maskable)
- [ ] `next.config` — cache headers for static assets
- [ ] Service worker (next-pwa or custom) — cache gym logger offline
- [ ] Offline queue: if save fails due to network, retry on reconnect
- [ ] "Add to Home Screen" banner on mobile

### 2.2 User Profile
- [ ] Profile page (`/settings/profile`) — change name, email, password
- [ ] Avatar (initials fallback, optional image upload later)
- [ ] Danger zone: delete account (deletes all data, cascades)

### 2.3 Personal Records
- [ ] Computed on session save: if Epley 1RM > previous best → insert `personal_records`
- [ ] PR badge on exercise history page (🏆 on the chart dot)
- [ ] All-time PRs page at `/gym/records`

### 2.4 Body Weight Log
- [ ] Daily weight entry widget on gym home (small card, optional)
- [ ] Stored in `body_weight_log` table
- [ ] Trend chart on profile page (SVG, same style as exercise chart)
- [ ] Fed into AI context for mesocycle generation

### 2.5 Calendar View
- [ ] Monthly calendar at `/gym/calendar`
- [ ] Each day cell: dot color = session type (upper=blue, lower=green, rest=empty)
- [ ] Click a day → go to that session

---

## Phase 3 — AI Improvements (estimated 1–2 weeks)

### 3.1 Smarter Analysis
- [ ] Deload detection: avg RPE > 8.5 over 3+ consecutive sessions → alert on home
- [ ] Volume tracking: flag if weekly volume drops significantly (possible overreaching)
- [ ] AI reads body weight trend and PRs when generating next mesocycle

### 3.2 Exercise Substitution
- [ ] "Can't do this today" button per exercise in logger
- [ ] Opens AI suggestion drawer: 2–3 alternatives targeting same muscle group
- [ ] One-tap to swap in the suggestion

### 3.3 Weekly AI Summary
- [ ] Generated every Monday (or on-demand)
- [ ] Covers: sessions completed vs planned, volume trend, notable PRs, recommendation for the week
- [ ] Shown as a dismissible card on gym home

### 3.4 Onboarding AI Flow
- [ ] New user wizard: name, sport/goal, training history (beginner/intermediate/advanced)
- [ ] AI generates first mesocycle from scratch based on answers
- [ ] Pre-populates situation prompt

---

## Phase 4 — Social & Growth (ongoing)

### 4.1 Templates
- [ ] Built-in mesocycle templates (PPL, Upper/Lower, Full Body, etc.)
- [ ] Browse & import template → customize before saving
- [ ] User can publish their mesocycle as a template (optional)

### 4.2 Sharing
- [ ] Read-only share link for a session (`/share/[token]`)
- [ ] Share link for exercise progression chart

### 4.3 Coach Mode (future)
- [ ] Trainer account can view/add notes to client's sessions
- [ ] Client approves coach access

### 4.4 Native App (future)
- [ ] Capacitor wrapper for true native features (push notifications, haptics)
- [ ] Publish to Play Store via PWABuilder in the interim

---

## Database Schema

```
users                    id, email, name, password_hash, created_at
user_settings            user_id (1:1), situation_prompt, rest_timer_default
mesocycles               user_id, name, phase, start/end_date, exercises (jsonb), is_active
gym_sessions             user_id, date, name, session_type, started_at, finished_at
gym_exercises            session_id, name, target_sets, target_reps, order_idx
gym_sets                 exercise_id, set_no, reps, weight, rpe, done
exercise_catalog         user_id (null=global), name, muscle_groups (jsonb), equipment
personal_records         user_id, exercise_name, weight, reps, e1rm, achieved_at
ai_analyses              user_id, session_id, summary, decisions (jsonb)
ai_briefings             user_id, session_id, note
weight_overrides         user_id, exercise_name, next_weight_kg  [UNIQUE per user+exercise]
body_weight_log          user_id, date, kg                       [UNIQUE per user+date]

-- Auth.js required tables --
accounts                 OAuth provider links
sessions                 Session tokens
verification_tokens      Email verification
```

---

## Deployment

```
docker-compose.yml
  postgres:16-alpine    ← data volume mounted
  coach-app             ← built from Dockerfile
  (caddy)               ← HTTPS reverse proxy (add later)

.env.production
  DATABASE_URL
  NEXTAUTH_SECRET
  NEXTAUTH_URL
  OPENROUTER_API_KEY
  INTERVALS_API_KEY
```

---

## Migration Strategy

1. New Postgres DB + schema created (empty)
2. Run `npm run migrate:json` — reads all existing JSON files, inserts into DB under Sacha's account
3. Verify: compare session count, exercise history, AI analyses
4. Switch app to DB mode (feature flag or env var)
5. Run in parallel for 1 week, then remove JSON fallback
6. Keep JSON files as backup for 30 days

---

## What's NOT changing

- UI components and Tailwind styles (keep everything)
- AI prompts and logic (only add userId to function signatures)
- Next.js App Router patterns (server components, API routes)
- OpenRouter/Gemini integration
- The exercise catalog data and existing session data
