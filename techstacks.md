# Plotkraft — Tech Stacks & SDK Decisions (DRAFT)

> Part of the Plotkraft doc set: design.md (what & why) · **techstacks.md** (this file — tools & SDKs) · architecture.md (system & build plan).
> Hackathon: Agentic Cinema, Parallel track. Deadline: Sep 7, 2026, 2:00 PM PT (banner says Sep 9 — unresolved).

## 1. Hackathon constraints shaping the stack (hard requirements)

- **Track:** Parallel — must call Parallel Search API at runtime via an official integration. README mention alone fails Stage-One screening.
- **AI models:** Gemini / Vertex AI ONLY. No OpenAI/Anthropic/AWS/Microsoft AI anywhere — including sample code copied from Parallel docs (their examples default to OpenAI; swap all of it). Non-AI third-party services (hosting, DBs, frameworks) are fine.
- **Submission:** hosted working URL + ≤3-min English demo video (YouTube/Vimeo) + public repo with OSI license visible in About section + evidence both Google Cloud and Parallel are called at runtime.
- **New project only**, built during contest period. Web app qualifies.

## 2. Partner track decision — Parallel (LOCKED, verified against official Resources page)

| Partner | Verdict | Why |
|---|---|---|
| **Parallel** | ✅ **Chosen** | Researcher/Comparables agents need cited web search — natural fit. Three compliant paths incl. Gemini-native Grounding config. TS SDK. Extract API bonus for deep citations. $20–$80 signup credits. |
| ClickHouse | ❌ | No large analytical dataset in Plotkraft; OLAP would be visibly bolted-on (judges score effective partner use). $400 credits noted if we ever pivot. |
| Grafana | ❌ | Metrics/logs/traces don't exist in a screenwriting tool; rules say AI Observability alone doesn't qualify. Hosted MCP is interactive-OAuth-only (bad for server-side agents anyway). |
| IBM | ❌ | Must build *using IBM Bob* (dev-process mandate), off-stack, trial-gated. |
| Replit | ❌ | Must use Replit Agent + host on Replit — abandons our NestJS/Cloud Run/Firebase architecture. |

## 3. The stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js** + **React Flow (@xyflow/react)** | Canvas of scene-card custom nodes + labeled causal edges; minimap/zoom built in |
| Backend | **NestJS** on **Cloud Run** | Home turf; hosts the Gemini orchestrator + agent tool endpoints |
| AI SDK | **`@google/genai`** (accepted-SDK list) | Function-calling orchestrator; Gemini multimodal for script parsing; Veo via `generateVideos`; Imagen 3 for storyboards; Gemini TTS multi-speaker (stretch table read) |
| Web research | **`parallel-web`** TS SDK (v1.3.x) | Search + Extract APIs; zero deps; typed surface |
| Auth | **Firebase Auth, Google provider only** | See §5 |
| Data | **Firestore** (projects, scene graph, bible, notes, annotations, snapshots) | Fine-grained docs — see architecture.md concurrency design |
| Presence | **Firebase RTDB** | Cursors + soft-lock "editing" markers (`onDisconnect` cleanup) |
| Files | **Cloud Storage** | Scripts, Veo clips, Imagen boards |
| Secrets | **Secret Manager** | Parallel API key |

## 4. SDK decisions (all spike-verified or rules-verified)

### 4.1 Parallel integration — DECIDED: direct `parallel-web` SDK as a Gemini function-calling tool
Spike compiled clean (`researcher-agent-spike.ts`): Gemini plans the search via function calling → `parallel.search()` → `parallel.extract()` on top source → Gemini synthesizes cited verdict.

Rejected alternatives:
- **`@parallel-web/ai-sdk-tools`** — peer-requires Vercel AI SDK (`ai@^6`) = a whole extra agent framework; pins stale `parallel-web@^0.5.0` (current 1.3.2); muddies the "google-genai called at runtime" compliance story.
- **Gemini Grounding with Parallel as provider** — compliant and Gemini-native, but a managed low-code path; we need tool-level control for multi-agent orchestration anyway.

API notes for the build:
- `mode`: `'basic'` for interactive flag-checks, `'advanced'` for deep background passes (maps to model-routing philosophy).
- `client_model` hint: tell Parallel the consumer is Gemini Flash — tailors result formatting.
- `session_id`: chain search→extract calls within one research run for better contextual results.
- `search_queries`: 2–3 concise 3–6-word queries — encode this in the Researcher prompt.
- `advanced_settings.max_results` + excerpt settings control token spend.

### 4.2 Orchestrator — DECIDED: plain `@google/genai` function calling (not ADK)
`@google/adk` v2.0.0 (official ADK JS) is real and actively maintained, but carries MikroORM + full OpenTelemetry + A2A deps, wraps `@google/genai` underneath, and its session/runner abstractions are learning-curve risk on an 8-day build. `google-genai` is equally on the accepted-SDK list; our state lives in Firestore regardless.

### 4.3 Auth — DECIDED: Firebase Auth (Google provider), Clerk deferred
Native fit with Firestore/RTDB security rules (`request.auth.uid`) — the live canvas listeners and presence markers depend on Firebase tokens. Clerk would require a Clerk→Firebase custom-token exchange (two auth systems, token expiry skew); its real payoff — orgs, invites, member management — exceeds our shareable-project-link scope. ~30 min to implement: `signInWithPopup`, one button. Revisit Clerk post-hackathon if Plotkraft needs teams/SSO.

## 5. Budgets & credits

| Resource | Amount | Action |
|---|---|---|
| Google Cloud | $100 hackathon credits | Request form **deadline Aug 31** — submit immediately (1–5 business-day approval) |
| Parallel | $20–$80 auto-granted at signup (varies by email type/region); +$5/mo recurring free if credit card added (no charges) | Sign up now; cache aggressively; cap calls during dev; support@parallel.ai |
| Veo / Imagen | Paid Vertex usage | Pre-generate + cache all demo clips; never live-generate in the demo (latency/cost risk) |

## 6. Compliance checklist (repo/runtime)

- [ ] `@google/genai` imported and called at runtime (orchestrator, parsing, Veo/Imagen).
- [ ] `parallel-web` imported and called at runtime (Researcher; Comparables if built) — visibly central in UI (citations).
- [ ] Zero non-Google AI SDKs anywhere in the dependency tree or code samples.
- [ ] OSI license file, visible in repo About section.
- [ ] Hosted URL live; demo video ≤3 min, English, shows agents functioning.
