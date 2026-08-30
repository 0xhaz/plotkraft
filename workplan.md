# Plotkraft — Workplan (8-day compressed build)

> Part of the Plotkraft doc set: design.md (what & why) · techstacks.md (tools & SDKs) · architecture.md (system & build plan) · **workplan.md** (this file — who does what, when, and what gets cut).
> Written Aug 30, 2026, 19:30 MYT. Working deadline: **Sep 7, 2026, 2:00 PM PT = Sep 8, 5:00 AM MYT**. Treat Sep 9 as a rumor until confirmed; build to Sep 7.
> Solo build. Every estimate below is *solo* hours, and assumes ~10 productive hours/day for 8 days ≈ 80 hours total. The plan below budgets ~68, leaving ~15% slack. That slack will be consumed; do not spend it in advance.

---

## 0. The governing constraints

Three things kill this submission regardless of code quality. They are checked every single day (see §7 daily ritual):

1. **Parallel Search must be called at runtime, visibly.** Track requirement. A README mention fails Stage One. Citations must be on screen in the demo video.
2. **Gemini / Vertex AI only.** Zero OpenAI/Anthropic/AWS/Microsoft AI in the dependency tree — including code pasted from Parallel's docs, whose examples default to OpenAI.
3. **Hosted URL + ≤3-min video + public repo with OSI license visible in the About section.** A perfect app with no hosted URL scores zero.

Everything else in this plan is negotiable. These three are not.

---

## 1. Day 0 — TONIGHT (Aug 30, ~3h). Do not sleep on these.

These are all deadline- or lead-time-bound. They are not coding tasks and cannot be recovered later.

| # | Task | Why tonight | Est |
|---|---|---|---|
| D0-1 | **Submit the GCP $100 credits form** | Form closes **Aug 31**; approval takes 1–5 business days. Miss it and Veo/Imagen come out of pocket. | 15m |
| D0-2 | **Sign up for Parallel, capture API key, note credit balance** | $20–$80 auto-granted. Add a card for the +$5/mo recurring free tier (no charges). Key goes straight into Secret Manager, never into git. | 20m |
| D0-3 | **Email janet@devpost.com re: Sep 7 vs Sep 9 deadline** | Costs 5 minutes, buys up to 2 days. Send tonight so a reply lands during the build. | 5m |
| D0-4 | **Create the GitHub repo, public, with an OSI license (MIT) and a filled-in About section** | Compliance artifact #3. Doing it first means it can never be forgotten at 3 AM on submission day. | 15m |
| D0-5 | **Register plotkraft.com; run TESS + "plotkraft screenwriting" collision check** | If the name is taken, every screenshot, the video, and the repo name are wrong. Discover it now, not on day 6. Fallback: Beatkraft (only if the with-t domain is securable). | 45m |
| D0-6 | **Firebase project + GCP project created, Firestore + RTDB + Storage + Auth (Google provider) enabled, Vertex AI API enabled** | Console clicking is slow and boring; do it while tired. Blocks literally every subsequent day. | 45m |

**Day 0 done-check:** credits form submitted · Parallel key in hand · repo public with license · Firebase/GCP consoles provisioned · name confirmed or fallback chosen.

---

## 2. The scope ladder, re-cut for 8 days

The ladder in architecture.md §6 was written for ~2.5 weeks. Compressed, it becomes four stages with **explicit cut lines**. Anything below a cut line is only built if the stage above finished early — never in parallel, never "just quickly".

| Stage | Days | Contents | Status |
|---|---|---|---|
| **A — Spine** | 1–4 | Script upload → Gemini parse → causality graph on React Flow → load scores → what-if re-run → one Parallel search with visible citations → deployed on Cloud Run | **Non-negotiable.** This alone is a submittable product. |
| **B — Depth** | 5–6 | Note reconciliation dashboard **OR** character/world bible — pick one on the morning of Day 5, build the other never | Build |
| **C — Trust & polish** | 7 | Cached Imagen storyboards + 2 Veo clips, Tier 1 annotations, Researcher citations promoted in UI, visual polish pass | Build |
| **D — Submission** | 8 | Video, README, hosted-URL verification, submit **a full day early** | **Non-negotiable.** |
| **— cut line —** | | | |
| E — Stretch | never | Tier 2 presence cursors, setup/payoff tracker, logline generator, snapshot diff, Comparables agent, Gemini TTS table read | Only if a whole day falls out of the sky |

**Comps benchmarking is the first thing to cut** (Prescene parity, not differentiation) — already below the line. Note reconciliation is unique and outranks the bible if forced to choose, but the bible is cheaper; §5 Day 5 makes the call with real information.

---

## 3. Day-by-day

### Day 1 (Aug 31) — Skeleton walks end to end. ~10h

Goal: an ugly page that uploads a `.fountain` file and renders *something* on a canvas, deployed to Cloud Run. Ugly is fine. Deployed is not optional — deploying on day 1 removes the single biggest late-stage risk.

- **1-1 (1h)** Monorepo scaffold: `apps/web` (Next.js) + `apps/api` (NestJS), pnpm workspace. `nest` CLI isn't installed locally — use `pnpm dlx @nestjs/cli new` rather than a global install.
- **1-2 (1.5h)** Firebase Auth Google sign-in, one button. ~30 min of code per techstacks.md §4.3; budget triple for first-time config friction.
- **1-3 (2h)** Fountain ingest. **Fountain-first is decided** — it is trivially parseable and removes an entire class of day-1 risk. PDF via Gemini multimodal is stretch, and stretch is below the cut line. Parse to `{ scenes: [{ id, heading, action, dialogue }] }`.
- **1-4 (2h)** Firestore write path with the **week-one data model** (§4 below). Getting this shape right today is the difference between a working what-if on Day 3 and a rewrite.
- **1-5 (2h)** React Flow canvas rendering scene cards from Firestore via `onSnapshot`. No custom styling yet.
- **1-6 (1.5h)** Dockerfile + Cloud Run deploy of the API; Next.js deployed. **Hosted URL exists at end of Day 1.**

**Done-check:** logged in, uploaded a script, saw nodes on a canvas, at a public URL.

### Day 2 (Sep 1) — Causality. ~10h

Goal: the graph means something.

- **2-1 (3h)** `causalityPass`: Gemini classifies every beat transition as *therefore* / *but* / *and then*, each with a one-line justification. Gemini Flash, structured output, batched over the whole script in one call where possible.
- **2-2 (1.5h)** Persist edges as first-class Firestore docs with stable IDs (§4). The stored edge list *is* the dependency map for what-if — this is why it can't be derived on the fly.
- **2-3 (2h)** Custom React Flow edges, visually distinct per type, label + justification on hover. This is the visualization that gets ~10 seconds of named screen time in the video; it is worth real styling effort even today.
- **2-4 (1.5h)** Structural load score from graph centrality; card size/heat reflects it; zero-downstream-edge scenes flagged as cut candidates.
- **2-5 (2h)** Reliability fallback from architecture.md §5: **writer-confirmed edges.** Gemini's labels on a real 100-page script will be imperfect; let the writer correct an edge type in one click. This converts a weakness into the "diagnostic, not oracle" positioning, and it is a demo beat.

**Done-check:** a real script produces a labeled causal graph with load-weighted cards, and a wrong edge can be corrected by hand.

### Day 3 (Sep 2) — What-if, the hero feature. ~10h

This is the best 15 seconds of the demo video. It gets a full day.

- **3-1 (3h)** Dirty-subgraph computation: given a cut/moved scene, walk the causally-downstream nodes. Pure function over the stored edge list, unit-tested — the one piece of this build that genuinely deserves tests, because a subtly wrong traversal produces a demo that lies.
- **3-2 (3h)** What-if re-run: agents re-analyze *only* the dirty slice, on an **ephemeral in-memory graph copy** (never shared state — one user's what-if must not mutate everyone's canvas).
- **3-3 (2h)** The visual payoff: drag a scene out → orphaned payoffs, unexplained character knowledge and continuity breaks light up red, progressively as each agent lands.
- **3-4 (2h)** Parallel-agent execution + streaming: Researcher, Story Logic and continuity checks are independent passes — fire concurrently, stream flags onto the canvas as each returns. Progressive flags, never a spinner.

**Done-check:** drag a load-bearing scene off the board; downstream beats light up in under ~10 seconds.

### Day 4 (Sep 3) — Researcher + Parallel compliance. ~9h

Goal: compliance requirement #1 is satisfied and *looks* good.

- **4-1 (2h)** Port `researcher-agent-spike.ts` into the NestJS orchestrator as a real tool. It already type-checks; this is wiring, key management (Secret Manager), and error handling.
- **4-2 (2h)** Claim extraction: Gemini identifies checkable real-world claims in the script (locations, brands, historical/legal/medical/technical facts) and hands them to the Researcher.
- **4-3 (2h)** Citation UI in the scene side panel. **Prominent.** Judges and the Stage-One viability screen both look for this.
- **4-4 (1.5h)** Caching + call caps: cache every Parallel response by claim hash, `mode: 'basic'` everywhere interactive, `mode: 'advanced'` only in deliberate background passes. Credits are finite and dev burns them fastest.
- **4-5 (1.5h)** Accept / dismiss / disagree on every flag, persisted. Cheap, and it is the entire WGA-aware positioning made concrete.

**Done-check:** a scene panel shows a fact-check verdict with real, clickable Parallel citations. **Stage A complete — the project is now submittable.**

### Day 5 (Sep 4) — Depth: pick ONE. ~10h

Decide in the morning, in writing, then don't revisit:

- **Note reconciliation** (~8h) — unique on the market, addresses the #1 researched pain, needs sample notes authored to demo.
- **Character/world bible** (~6h) — cheaper, feeds the Continuity agent, less demo-legible on its own.

**Default: note reconciliation**, unless Day 4 ran over, in which case take the bible. The tiebreaker is not value — it is which one still leaves Day 6 intact.

- **5-1 (3h)** Ingest pasted/uploaded notes from multiple sources (producer, exec, peer, coverage).
- **5-2 (2h)** Map each note to affected scene(s); pin as cards on the canvas.
- **5-3 (2h)** **Contradiction detection between notes** — the actual differentiator. Two notes demanding opposite changes to the same scene get surfaced as a conflict.
- **5-4 (1h)** Dashboard view: all notes, their scenes, their conflicts.
- **5-5 (2h)** Buffer. It will be used.

### Day 6 (Sep 5) — Continuity + Tier 1 collaboration. ~10h

- **6-1 (3h)** Continuity agent: contradictions across scenes, using whichever of bible/notes exists. Ship as **"flags to review"**, never as assertions — false-positive rate on contradiction detection is the known risk, and the framing defuses it.
- **6-2 (2h)** Dismissal learning: dismissed flags write per-project suppression rules to Firestore. Small feature, disproportionate "agentic" credibility with judges.
- **6-3 (3h)** Tier 1 async annotations: shareable project link, comments pinned to scene nodes, badges on cards. Append-only subcollections, so simultaneous comments cannot conflict.
- **6-4 (2h)** Optimistic versioning + soft-lock presence markers (§4). Only if the demo will show two windows; otherwise defer and say so.

### Day 7 (Sep 6) — Previz, polish, and the sample script. ~10h

- **7-1 (3h)** **Pre-generate and cache all Imagen 3 storyboard panels and 2 Veo clips.** Never live-generate in the demo — latency and cost are both unacceptable on camera. This is the default posture in architecture.md §5, not a fallback.
- **7-2 (2h)** Wire cached previz into the UI, selected by load score (load-bearing scenes get the Veo clips — this closes the loop between the analysis and the visuals).
- **7-3 (3h)** Visual polish pass: canvas layout, right-side inspector, bottom activity/log strip. The Design judging criterion is a full quarter of the score and this is the only day allocated to it.
- **7-4 (2h)** Finalize the **sample script — original content only, no third-party IP.** Flagged in architecture.md §7 as "don't leave for the last day"; if Day 1–6 slipped, this is the thing most likely to have been skipped, so it is re-listed here as a hard gate.

### Day 8 (Sep 7) — Submit early. ~9h

Target: submitted by midday PT, not at 1:59 PM.

- **8-1 (3h)** Demo video, ≤3 min, English. Beat sheet: problem (20s) → upload & causal graph (30s) → **what-if hero moment (15s)** → Story Logic therefore/but named on screen (10s) → cited Researcher fact-check (20s) → note reconciliation (20s) → previz (15s) → collab moment, two windows (15s) → efficiency line, *"a structure pass that took a $300 coverage service two weeks — in ninety seconds, on every draft"* (15s). Show agents **working**, not a cinematic trailer — the rules require it.
- **8-2 (1.5h)** README: architecture diagram, agent roster, explicit "Google Cloud called at runtime / Parallel called at runtime" evidence section with file-and-line pointers.
- **8-3 (1h)** Full compliance sweep (§6 checklist), including `grep -ri "openai\|anthropic\|@aws\|azure" --include=package.json --include=*.ts` over the whole tree.
- **8-4 (1h)** Verify the hosted URL from a logged-out browser on a different network. The classic failure is an app that only works on the builder's machine.
- **8-5 (1h)** Submit.
- **8-6 (1.5h)** Reserve. If Sep 9 turns out to be real, this becomes a second polish pass — not new features.

---

## 4. Week-one data model (build on Day 1, painful to retrofit)

From architecture.md §4. These five decisions are load-bearing and cheap now, expensive later:

```
projects/{projectId}
  scenes/{sceneId}              ← stable IDs, `version` field, `position`
    annotations/{annotationId}  ← append-only
    flags/{flagId}              ← append-only, stamps the scene `version` analyzed
  edges/{edgeId}                ← stored edge list: {from, to, type, justification, confirmedByWriter}
  notes/{noteId}
  bible/{factId}
  suppressions/{ruleId}         ← dismissal learning
  snapshots/{snapshotId}
```

- **Stable scene IDs + stored edge lists** — the dirty-subgraph computation on Day 3 is impossible without them.
- **`version` on scene docs** — edits run in a Firestore transaction (check → increment → write); a mismatch surfaces "updated by Maya — review & retry" with fresh content, visibly, never a silent overwrite.
- **Append-only subcollections** for anything comment- or flag-shaped — most collaboration activity is annotation-shaped, and append-only makes it conflict-free by construction.
- **Field-level updates** (`update({position})`, never `set()` of a whole doc) — a card move and a summary edit on the same scene both land.
- **Agents in their own lane** — agent output lives in fields and subcollections humans never edit. Human/agent overwrite becomes structurally impossible rather than merely unlikely.

---

## 5. Risk register

| Risk | Trigger to watch | Response | Decide by |
|---|---|---|---|
| Gemini causal labeling unreliable on a real 100-page script | Day 2 spot-check against a script you know | Writer-confirmed edges (2-5) — already in the plan, not a fallback | Day 2 EOD |
| Contradiction detection false-positive storm | Day 6 first run | Ship as "flags to review"; lead the demo with causality instead of continuity | Day 6 midday |
| Veo latency/cost blocks iteration | First generation attempt | Pre-generate + cache (7-1); Imagen storyboard tier carries previz breadth alone if Veo is dropped entirely | Day 7 morning |
| Parallel credits run low | Check balance daily | Cache by claim hash, cap calls, `mode: 'basic'` everywhere interactive | Continuous |
| GCP credits not approved in time | No approval by Sep 3 | Previz becomes Imagen-only; drop Veo; the causal graph carries the demo | Sep 3 |
| Day 4 runs over → Stage A incomplete | End of Day 4 | Cut Day 5 depth entirely, spend Day 5 finishing the spine. **Stage A > everything below it.** | Day 4 EOD |
| Deadline is actually Sep 7 and Day 8 slips | Day 7 EOD | Submit whatever is deployed on Day 7 night, then improve. A submitted B+ beats an unsubmitted A. | Day 7 EOD |

---

## 6. Compliance checklist (re-verify on Day 8, glance at daily)

- [ ] `@google/genai` imported and called at runtime — orchestrator, parsing, Veo/Imagen
- [ ] `parallel-web` imported and called at runtime — Researcher; citations visible in the UI
- [ ] Zero non-Google AI SDKs anywhere in the dependency tree **or in copied code samples**
- [ ] OSI license file, visible in the repo's About section
- [ ] Hosted URL live and reachable logged-out, from another network
- [ ] Demo video ≤3 min, English, shows agents functioning
- [ ] New project, all commits within the contest period
- [ ] Sample script is original content — no third-party IP in the video

---

## 7. Daily ritual (~20 min, every morning)

1. Is the hosted URL still up? (If it broke overnight, that is the day's first task, before anything else.)
2. Parallel credit balance — still healthy?
3. Yesterday's stage gate: met, or is today already borrowing from tomorrow?
4. What is the next thing that would get cut, and is today the day to cut it?
5. Commit and push. Public repo, contest-period commits — an empty commit history on Day 8 looks like a violation even when it isn't.

---

## 8. Open questions carried from the doc set

- [ ] **Sep 7 vs Sep 9 deadline** — emailed Day 0 (D0-3). Build to Sep 7 regardless; treat any extension as polish time, never as scope.
- [ ] **GCP credits form** — due Aug 31 (D0-1).
- [ ] **plotkraft.com + trademark/collision check** — D0-5. An existing screenwriting app is literally named *Causality*; that is the exact trap to avoid.
- [ ] **Verify Prescene's current feature set** before finalizing positioning claims in the video and README. 30 minutes, best spent on Day 7 alongside the README, when the claims are actually being written.
- [ ] **Fountain vs PDF ingest** — resolved in this plan: Fountain-first, PDF is below the cut line.
