# Plotkraft — demo runbook

> Doc set: design.md (what & why) · techstacks.md (tools) · architecture.md (system) · workplan.md (schedule) · **DEMO.md** (this file — recording the submission video).

The submission needs a **≤3-minute English video** that shows the agents *working*,
plus visible evidence that Google Cloud and Parallel are called at runtime. This
file is the shot list, the narration, and the pre-flight checks.

---

## 0. Pre-flight (~10 min before recording)

```bash
pnpm emulators          # terminal 1 — Auth 9099, Firestore 8181, Storage 9199
pnpm dev:api            # terminal 2 — API on 8088
pnpm dev:web            # terminal 3 — web on 3001
pnpm seed:demo          # terminal 4 — builds the whole demo state, ~3 min
```

`seed:demo` prints three URLs. Open all three as tabs **before** recording and let
each finish loading:

| Tab | What it is |
|---|---|
| `/project/{draft}` | The board — your own draft, every diagnostic agent already run |
| `/project/{draft}/script` | The reading view |
| `/project/{reference}` | Reference mode, Craft agent already run |

**Sign in with "Dev sign-in"** in the navbar first, or every tab shows access-denied.

### Hard rules, worth re-reading before you hit record

- **Original content only.** `samples/the-quiet-part.fountain` is ours. No produced
  screenplay may appear on screen — not a page, not a slugline, not a scene card.
  That rules out the 244-scene feature entirely, including the act/sequence
  navigation, which is the one feature this sample cannot show well.
- **Never generate live.** Storyboards are already drawn by `seed:demo`. Image
  generation is rate-limited and returned 429s under load; a retry loop on camera
  is a dead demo.
- **Do not claim Veo.** Veo is not accessible on this project (verified — see
  architecture.md §4b). The video must not imply animatics exist.
- Agent runs take real seconds. Everything is pre-run, so **click to reveal, not to
  compute** — except the one deliberate live run in beat 5.

---

## 1. The cut (180 seconds)

Eight agents will not fit in three minutes. Twenty seconds each teaches nothing.
This cut shows **five things properly** and names the rest once.

| # | Time | On screen | Say roughly |
|---|---|---|---|
| 1 | 0:00–0:15 | Landing page | "A screenwriter's second act sags and nobody can tell them why. Coverage costs $60 to $1,500 and takes two weeks. Plotkraft is a room of agents that reads the draft in ninety seconds." |
| 2 | 0:15–0:35 | `/new` → import the sample → board appears | "Upload a screenplay. It becomes a board of scenes with stable identity — every agent works off this." |
| 3 | 0:35–1:05 | Board: hover a `but` edge, then a dashed `and then` | "The Story Logic agent runs the Parker–Stone test on every joint. Therefore, but — or *and then*, which means nothing holds those two scenes together. Weak joints are dashed, so a sagging act is something you see, not something you suspect." |
| 4 | 1:05–1:35 | Select a load-bearing scene → **Simulate cut** | "Cut a scene before you cut it. Payoffs whose setup just vanished, characters who now walk on carrying history the audience never saw. It runs on a private copy of the graph — asking never disturbs what your collaborators see." |
| 5 | 1:35–2:10 | **Run Researcher live.** Open a flag, click a citation | "Now a live call. Gemini pulls the checkable claims; Parallel searches the web; Gemini judges only what came back. Here it caught a line about FOIA response times — and these citations are real pages, not invented URLs." |
| 6 | 2:10–2:35 | **Notes & conflicts** panel | "Four sets of notes — producer, executive, coverage, a writer friend. The producer wants the diner scene cut. The executive wants it built out. Both are decision-makers, so it's blocking. Nothing else on the market tells a writer that before they rewrite twice." |
| 7 | 2:35–2:50 | Story Circle wheel, then storyboard panels | "The circle places every scene and computes the proportions — the numbers are arithmetic, never generated. And the scenes carrying the most weight get boarded." |
| 8 | 2:50–3:00 | Board, wide | "A structure pass that took a coverage service two weeks — in ninety seconds, on every draft." |

**Beat 5 must be a genuine live run.** It is the runtime evidence for both required
integrations in one shot: Vertex and Parallel, on camera, producing citations you
then click. Everything else can be pre-run.

---

## 2. What is deliberately cut, and why

Say these exist; do not spend time on them.

| Cut | Why |
|---|---|
| Act/sequence navigation | Only impressive at feature scale, and the only feature-scale script available is not ours to show |
| Script view | Worth one second of B-roll; it does not demonstrate an agent |
| Craft / reference mode | A strong idea that needs its own 30 seconds to land. Name it, cut the demo |
| Continuity + bible | Found 0 contradictions on this sample, which is correct but undemonstrative |
| Draft states, editing, dragging | Product polish, not the pitch |

---

## 3. Compliance check — tie each requirement to a moment

- [ ] **`@google/genai` called at runtime** — beat 5 runs it live; beats 3, 6, 7 show its output
- [ ] **`parallel-web` called at runtime** — beat 5, with clickable citations on screen
- [ ] **Citations visible in the UI** — beat 5, the Stage-One screen looks for this
- [ ] **Video ≤3:00, English, shows agents functioning** — the whole cut
- [ ] **Hosted URL live** — check logged-out, from another network, before submitting
- [ ] **Public repo, OSI licence visible in About** — done (MIT, detected by GitHub)
- [ ] **No third-party IP on screen** — original sample only
- [ ] **No non-Google AI SDK anywhere** — `grep -ri "openai\|anthropic" --include=package.json`

---

## 4. Recording notes

- Record at 1280×800 or similar. The canvas is dense; a 4K window makes text unreadable when scaled down.
- Zoom the board so 6–10 cards fill the frame. Fitting all 13 makes every label illegible.
- Do a silent rehearsal pass first. The timings above are estimates and have **not** been verified against a real recording — expect beat 5 to run long.
- If the Researcher is slow on the day, cut to the already-seeded flags and say "already run" rather than waiting on screen.
- Close the emulator UI tab. A judge seeing `localhost:4001` will wonder whether anything is deployed.

---

## 5. Before you submit

1. Deploy the API and web to Cloud Run; confirm the hosted URL **from a phone on mobile data**.
2. Enable the Google sign-in provider in the Firebase console — it cannot be done from the CLI, and without it nobody but you can sign in.
3. README: architecture diagram, agent roster, and an explicit "called at runtime" section with file-and-line pointers.
4. Upload the video unlisted, watch it end to end once, then submit — **a day early**.
