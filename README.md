# VeritasGuard

**Evidence-based news verification.** Paste a forwarded message, headline or link; VeritasGuard checks it
against professional fact-checks and independent reporting, and shows you every source behind the verdict.

The product rule: **a verdict is only as good as the evidence you can check yourself.** Every citation in a
report came back from a real request to a real provider and links to the original document.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Prisma 6 |
| Styling | One design system — CSS custom properties + CSS Modules |
| Auth | JWT in an httpOnly cookie, bcrypt, RBAC |
| Evidence | Google News, Wikipedia, Wikidata (no key) + Google Fact Check Tools, NewsAPI (optional) |
| Semantic layer | Sentence Transformers (`all-MiniLM-L6-v2`) via Transformers.js — runs in-process, no API |
| Reasoning | Groq (constrained to retrieved passages) |
| Tests | Vitest + Testing Library |

---

## Getting started

```bash
npm install

npm run dev                    # http://localhost:3000 — works with no configuration
```

Verification works immediately: Google News, Wikipedia and Wikidata need no API
key. Configure the rest only when you want accounts and fact-checker rulings:

```bash
cp .env.example .env           # NOT .env.local — see the note below
npm run db:push                # create the schema
npm run db:seed                # reference data: roles, statuses, thresholds…
```

> **Use `.env`, not `.env.local`.** Next.js reads both, but the Prisma CLI reads
> only `.env`. Splitting them means `npm run dev` sees the database and
> `prisma db push` does not, which fails with
> *"Environment variable not found: DATABASE_URL"*.

No Postgres to hand? One container is enough:

```bash
docker run -d --name veritasguard-db   -e POSTGRES_USER=veritasguard -e POSTGRES_PASSWORD=veritasguard   -e POSTGRES_DB=veritasguard -p 5435:5432 postgres:16-alpine

# then in .env:
# DATABASE_URL="postgresql://veritasguard:veritasguard@localhost:5435/veritasguard"
```

### Required environment

| Variable | Required | Purpose |
|---|---|---|
| _(none)_ | — | Verification works out of the box on keyless providers |
| `DATABASE_URL` / `DIRECT_URL` | for accounts | PostgreSQL connection |
| `JWT_SECRET` | for accounts | Session signing. **Minimum 32 chars — no insecure fallback exists.** |
| `GOOGLE_FACT_CHECK_API_KEY` | recommended | Published fact-checker rulings — the heaviest-weighted evidence |
| `NEWS_API_KEY` | optional | Extra archive depth beyond Google News |
| `GROQ_API_KEY` | optional | Reasoning layer (6% of the decision) |
| `EMBEDDING_MODEL` | optional | Defaults to `Xenova/all-MiniLM-L6-v2`. Set to `Xenova/paraphrase-multilingual-MiniLM-L12-v2` for Indic-language support (~5x larger) |
| `DISABLE_EMBEDDINGS` | optional | Set to `1` to force lexical-only matching |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **The app never guesses.** If every provider is unreachable, or the authoritative record for an office
> claim cannot be retrieved, the verdict is `Uncertain` with an explanation — never a confident wrong answer.

### Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm start           # serve the build
npm test            # 248 tests, single run
npm run test:watch
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint
npm run verify      # typecheck + lint + test, as CI runs it
npm run db:studio   # browse the database
```

---

## How a verdict is reached

```
claim
 ├─ Layer 1  Language analysis           6%   how the claim is written
 ├─ Layer 2a Professional fact-checks   42%   Google Fact Check Tools — published rulings
 ├─ Layer 2b Independent corroboration  26%   Google News + NewsAPI, weighted by match x publisher reliability
 ├─ Layer 2c Reference sources          20%   Wikipedia + Wikidata current records
 ├─ Layer 3  Model reasoning             6%   reads ONLY the retrieved passages
 └─ Decision Engine -> Real | Fake | Uncertain + confidence + per-signal breakdown

Relevance scoring is **hybrid**: every retrieved item is scored both lexically
(weighted Jaccard) and semantically (Sentence Transformers cosine), and the
higher score wins. The two fail in opposite directions — lexical is precise about
named entities but blind to paraphrase; semantic catches paraphrase but is fuzzy
about names — so neither is allowed to veto the other.

Measured on "Vijay is the Chief Minister of Tamil Nadu" vs "The head of the Tamil
Nadu government is Vijay": lexical ~0.3, semantic ~0.91.

Plus a structured incumbency check: for "X is the <office> of Y" claims, Wikidata's
current, dated record is compared against the person named. This is the one case
where text matching actively misleads — coverage of a FORMER office holder reads
identically to coverage of the current one.
```

Guarantees enforced in code, each covered by tests:

- **The model cannot introduce a source.** It is asked for a score and a rationale, never for citations; any
  rationale naming an unretrieved outlet is discarded (`src/lib/llm.ts`).
- **Confidence always means certainty in the verdict shown** — for a `Fake` verdict, 91% means 91% confident
  the claim is *contradicted*. It is never inverted.
- **`Uncertain` is a real outcome**, produced whenever the evidence does not clear the decision band or no
  provider is reachable.
- **Absence of coverage is never treated as proof.** It is reported as thin evidence.
- **Scoring is deterministic.** No `Math.random()` anywhere in the decision path.

---

## AI models

| Role | Model | Key needed |
|---|---|---|
| Semantic search | Sentence Transformers `all-MiniLM-L6-v2`, in-process via Transformers.js/ONNX | no |
| Reasoning + report writing | Groq, `llama-3.1-8b-instant` with a fallback chain | yes |

### Adding your Groq key

```bash
# .env
GROQ_API_KEY="gsk_..."     # free key from https://console.groq.com/keys
GROQ_MODEL=""              # leave blank to use the fallback chain
```

Restart, then confirm the key actually works — not merely that it is present:

```bash
curl "http://localhost:3000/api/health?probe=1"
# {"groq":{"configured":true,"reachable":true,"model":"llama-3.1-8b-instant"}}
```

`GROQ_MODEL` is intentionally blank by default. Groq retires model ids on a
rolling basis, and a pinned id that disappears would turn every AI call into a
silent no-op, because this codebase degrades rather than failing loudly. The
client instead walks a chain of candidates and remembers whichever answers.

### What the LLM is and is not allowed to do

It has two jobs, both deliberately bounded:

1. **Reasoning signal — 6% of the verdict.** Given only the retrieved passages,
   it returns a score and a rationale. It is never asked for citations, and any
   rationale naming an outlet that was not retrieved is discarded.
2. **Report narrative.** After the verdict is fixed, it writes the plain-language
   explanation shown in the report and the PDF. It receives the verdict as an
   instruction, not a question.

It does **not** decide verdicts. Evidence weighting does that, deterministically.
A narrative that contradicts its own verdict, or cites a source that was never
retrieved, is thrown away and the deterministic summary is shown instead.

Everything works without a Groq key: verdicts, evidence, confidence and the
report all function, minus the AI-written paragraph.

## Project structure

The codebase is split three ways, and the split is **enforced**, not just
documented — see `tests/architecture.test.ts` and the `server-only` guards.

```
src/
  server/          BACKEND — never reaches the browser
    config/env.ts            environment access with fail-fast validation
    data/db.ts               Prisma client
    auth/                    session signing/verification, security answers
    http/rateLimit.ts        fixed-window limiter
    verification/            THE PIPELINE
      decisionEngine.ts        signal fusion -> verdict + confidence
      retrieval.ts             orchestrates providers, dedupe, ranking
      embeddings.ts            Sentence Transformers semantic similarity
      llm.ts                   constrained reasoning layer
      heuristics.ts            linguistic scoring
      providers/               googleNews, wikipedia, officeHolder, wikimediaClient

  shared/          THE CONTRACT — safe for both sides
    types.ts                 Verdict, RetrievedEvidence, VerificationReport…
    textMatch.ts             pure text utilities (no I/O, no config)
    siteUrl.ts               canonical URL resolution

  client/          FRONTEND — browser code
    components/ui/           design-system primitives
    components/layout/       header, footer, theme
    components/verify/       composer, progress, verdict report, evidence cards
    lib/                     exportReport, pdf, recentClaims (DOM/Blob APIs)

  app/             ROUTES ONLY — thin
    api/**/route.ts          backend entry points
    **/page.tsx              frontend entry points
```

### Why the split is enforced

Dependencies flow in one direction only:

```
client  ->  shared  <-  server
```

Neither side may import the other. Three mechanisms hold that in place:

1. **`import 'server-only'`** at the top of every module in `src/server`. If a
   client component imports one — directly or transitively — the build fails.
2. **`tests/architecture.test.ts`** independently asserts the boundary in both
   directions, that `shared/` has no dependencies at all, and that nothing
   still imports the retired `@/lib` layer.
3. **Types are declared in `shared/`** and imported *by* the server, never
   re-exported *from* it. Direction matters: the UI used to import its types
   from the retrieval module, which is what dragged the backend into the
   browser bundle in the first place.

This is not hypothetical tidying. Before the split, the client bundle contained
`onnxruntime`, `huggingface` and internal provider code, because one component
imported a single helper from `@/server/verification/retrieval`. Removing that
edge cut the client chunks from **1.3 MB to 768 KB**.

### Design system

All colour, spacing, radius, elevation, motion and type tokens live in **one place**:
[`src/app/globals.css`](src/app/globals.css). Components consume them via CSS Modules and never hard-code a
value. Light and dark themes are the same token names with different values, so nothing needs per-theme
branching in components.

Anything reusable — buttons, cards, fields, badges, meters, tables, tabs, skeletons, empty states — comes
from [`src/components/ui`](src/components/ui). Do not hand-roll these.

---

## Testing

```bash
npm test
```

213 tests across eight suites:

| Suite | Covers |
|---|---|
| `retrieval.test.ts` | publisher reliability, similarity, dedupe, ranking, fact-check stance mapping |
| `decisionEngine.test.ts` | three-state verdict, confidence semantics, weighting, caveats, stance labelling |
| `security.test.ts` | env fail-fast, security-answer hashing, rate limiting, LLM output constraints |
| `export.test.ts` | CSV escaping and formula-injection guards, real PDF byte output, pagination |
| `ui.test.tsx` | every primitive, including ARIA wiring and focus/disabled states |
| `verifyFlow.test.tsx` | the full verify → report → export journey against a mocked API |
| `embeddings.test.ts` | cosine maths, calibration, hybrid fallback, and the real model end-to-end |
| `architecture.test.ts` | the frontend/backend boundary, in both directions |

Tests marked `REGRESSION` pin behaviour that was previously broken — they exist so old defects cannot return.

---

## Accessibility

Semantic HTML throughout, labelled controls with `aria-describedby` hints and `role="alert"` errors, visible
focus rings on every interactive element, `role="meter"`/`tablist`/`status` where appropriate, a skip link,
roving tabindex on tabs, and full `prefers-reduced-motion` support. Both themes are built to WCAG AA
contrast.

---

## Deploying

### 1. Push to GitHub

```bash
git init                      # if not already a repo
git add .
git commit -m "VeritasGuard: evidence-based news verification"
git branch -M main
git remote add origin https://github.com/<you>/veritasguard.git
git push -u origin main
```

`.env*` files are gitignored (`.env.example` is deliberately re-included as the
template). Verify before your first push:

```bash
git status --porcelain | grep -E "^\?\?.*\.env" && echo "STOP: an env file is untracked-but-visible" || echo "safe"
```

### 2. Deploy on Vercel

1. **New Project → Import** your GitHub repository.
2. Framework preset is detected as **Next.js** — leave the build settings alone.
   `npm run build` already runs `prisma generate` first, which is required
   because Vercel caches `node_modules`.
3. Add environment variables (Project → Settings → Environment Variables):

   | Variable | Required | Notes |
   |---|---|---|
   | `JWT_SECRET` | for sign-in | 32+ chars. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `DATABASE_URL` | for sign-in | Vercel Postgres, Neon or Supabase |
   | `DIRECT_URL` | for sign-in | Same as above unless using a pooler |
   | `GOOGLE_FACT_CHECK_API_KEY` | recommended | Free. Adds published fact-checker rulings |
   | `NEWS_API_KEY` | optional | Extra archive depth |
   | `GROQ_API_KEY` | optional | Reasoning layer (8% of the decision) |
   | `NEXT_PUBLIC_SITE_URL` | recommended | Your custom domain, e.g. `https://veritasguard.app` |

4. **Deploy.**

> **It works with no configuration at all.** Verification runs on Google News,
> Wikipedia and Wikidata, none of which need a key. Without `DATABASE_URL` and
> `JWT_SECRET`, only sign-in, history and the dashboard are unavailable — the
> core product is fully functional.

### 3. Confirm the deployment

```bash
curl https://<your-app>.vercel.app/api/health
```

```json
{ "status": "ok", "checks": { "verification": true, "evidenceProviders": true, ... } }
```

`status` is `ok`, `degraded` (running, but something optional is missing — the
`degraded` array says what), or `unhealthy`.

### 4. Database setup (only if you want accounts)

Run once against your production database:

```bash
DATABASE_URL="<production-url>" npx prisma db push
DATABASE_URL="<production-url>" npm run db:seed
```

### Framework preset

`vercel.json` pins `framework: "nextjs"`. This matters if the Vercel project was
first imported while the repo was still a Vite app: Vercel remembers the Vite
preset and keeps looking for an output directory named `dist`, which a Next.js
build never produces. The symptom is a build that compiles fine and then fails
with *No Output Directory named "dist" found*.

If it persists after this file lands, the dashboard has an explicit override that
takes priority — clear it under **Settings → Build and Deployment → Framework
Settings**, set Framework Preset to **Next.js**, and switch Output Directory back
to its default rather than a literal `dist`.

### Build constraints on Vercel

Two things in `next.config.ts` exist purely to make the Vercel deploy work, and
should not be removed:

- **Platform-specific dependencies must be optional.** `oxlint` and `rolldown`
  ship Windows-only native bindings. Declared as regular `devDependencies`, npm
  fails the whole install on Vercel's Linux builders with `EBADPLATFORM`. They
  live in `optionalDependencies`, which npm skips when the platform does not
  match.
- **`onnxruntime-node` ships binaries for every platform** — linux 53 MB, win32
  124 MB, darwin 35 MB. Tracing all 211 MB into a function exceeds Vercel's
  250 MB limit, so `outputFileTracingExcludes` drops win32 and darwin. The
  Linux binary is loaded through a computed require the tracer cannot follow,
  so `outputFileTracingIncludes` adds it back for `/api/news/check` only. The
  traced function is ~84 MB.

If the semantic layer ever reports `loaded: false` on a deployment, check
`/api/health` first — scoring falls back to lexical silently by design, so the
symptom is quietly weaker matching rather than an error.

### Serverless behaviour you should know about

- **Rate limiting is per-instance.** Each warm Vercel instance keeps its own
  counters, so the effective limit is `limit × warm instances` rather than a
  hard global quota. It still stops a single client hammering an endpoint. For a
  strict global limit, swap the store in `src/lib/rateLimit.ts` for Redis
  (Upstash) — the `consume()` contract is unchanged.
- **The Wikimedia cache is per-instance.** A cold instance pays full price
  (~1.5–3s) for its first office lookup; warm instances answer in ~500ms.
  Correctness never depends on the cache.
- **`/api/news/check` is configured with `maxDuration = 30`.** The pipeline
  budget is 8s; the higher ceiling is headroom for a slow upstream.

---

## Known limitations

- **Not a replacement for a fact-checker.** This is a triage tool that shows its working.
- **English-language retrieval.** The PRD targets 22 Indian languages; providers are currently queried in
  English only.
- **Semantic *similarity*, not semantic *contradiction*.** Sentence Transformers scores how related two
  texts are, not whether one refutes the other. The structured incumbency check covers the case where this
  matters most — "X is the current <office> of Y" — but other contradictions are not detected.
- **No vector database.** Embeddings are computed per request and cached in memory; there is no persistent
  index, so evidence cannot be searched by vector at scale. `pgvector` on the existing Postgres is the
  natural next step.
- **Cold start cost.** The first request on a fresh instance downloads the model (~23 MB) and takes several
  seconds; scoring falls back to lexical until it is ready, so no request ever blocks on it.
- **Upstream throttling degrades to `Uncertain`.** When Wikimedia rate-limits the authoritative lookup for an
  office claim, the verdict becomes `Uncertain` with an explanation rather than falling back to news coverage,
  which cannot distinguish a current office holder from a former one. Retrying usually succeeds.
- **In-process rate limiting and cache.** Correct for a single instance; see the serverless notes above.
- **Admin surfaces are API-only.** `/api/feedback` and `/api/reports` work; their console UI is not built.

See [`AUDIT_REPORT.md`](AUDIT_REPORT.md) for the full status, including what remains outstanding.
