# Plotkraft — Product Design (DRAFT)

> Part of the Plotkraft doc set: **design.md** (this file — what & why) · techstacks.md (tools & SDKs) · architecture.md (system & build plan).
> Hackathon: Agentic Cinema, Parallel track. Deadline: Sep 7, 2026, 2:00 PM PT (banner says Sep 9 — unresolved).

## 1. One-liner & positioning

**Plotkraft** — a writers' room canvas where human notes and AI agents annotate the same beat sheet. A screenwriter uploads a script; a crew of Gemini agents makes it production-real — fact-checked, continuity-checked, structure-checked, and previsualized with Veo — on a shared interactive canvas.

**Positioning (WGA-aware):** Plotkraft is an AI *analyst/room*, not a writer. It diagnoses and organizes; it never generates prose. The writer stays the author, every AI flag is accept/dismiss. This defuses the dominant screenwriter objection to AI tools (2023 WGA MBA: AI is not a writer; use can't be required) and is a credible pitch differentiator.

**Name status:** Plotkraft (plotkraft.com available) — leading candidate, pending (a) trademark search (TESS at minimum) and (b) "[name] screenwriting" collision check (an existing app is literally named *Causality* — same trap to avoid). Runner-up: Beatkraft, only if the with-t domain is securable. "Continuity" retired as product name (kept as agent name).

## 2. Pain-point validation (deep research, Aug 2026)

Research into professional/freelance screenwriter pain points ranked these as the top pains — and mapped them to our features:

| Rank | Pain point | Who feels it most | Our answer |
|---|---|---|---|
| 1 | **Rewriting/revision hell + note management** — contradictory producer/exec notes, no way to reconcile; "death by notes" | Professionals | Note reconciliation dashboard (NEW), what-if re-run, load scores |
| 2 | **Structure/causality** — sagging Act 2, "and then" beat chains | Everyone | Story Logic agent (therefore/but), causality graph |
| 3 | **Continuity across drafts** — contradictions introduced in rewrites; show-bible burden ("walking bibles") | Everyone; acute in episodic TV | Continuity agent + character bible auto-extraction (NEW) |
| 4 | **Version control across drafts** — "Mystery D2" file naming chaos | Everyone | Canvas snapshot diff (NEW, stretch) |
| 5 | **Cost/quality of feedback** — coverage runs ~$60–$1,500; peer feedback unreliable; freelancers have no room | Freelancers | The whole product: an always-on diagnostic room + async annotations |
| 6 | **Loglines/pitching** — "hardest thing of all the elements"; must be redone every time the story changes | Freelancers | Logline generator from causal graph (NEW, cheap) |
| 7 | **Research burden/factual accuracy** — period/medical/legal scripts; audiences pause to fact-check; consultants expensive | Professionals | Researcher agent (Parallel, cited sources) |

**Competitive gaps confirmed:** Final Draft = formatting, doesn't diagnose story. WriterDuet/Arc = collaboration/versioning, no causal or continuity analysis. Save the Cat/Plottr/Dramatica = rigid templates, don't read YOUR script. Closest conceptual competitor is **Prescene** (chat-with-script, continuity flags, comps) — our differentiation vs. them: visual causal-graph canvas, what-if re-runs, note reconciliation, Veo previz. No tool combines causal graph + contradiction detection + cited fact-checking + previz in one place. (Open: verify current Prescene feature set before finalizing positioning.)

## 2b. Two modes: study, then write (added Aug 31)

The product does two jobs, and conflating them was a mistake. Diagnosing a
*produced* screenplay is useless — nobody can fix a film that has been shot.
Explaining how it earns its beats is exactly what a developing writer needs.

| Mode | What it is | What runs | Editing |
|---|---|---|---|
| **Reference** | A produced script the writer brings, to learn from | **Craft agent** — the job each scene performs, the device that performs it, and one transferable lesson | Read-only |
| **Original** | The writer's own draft | Story Logic, Story Circle, Researcher, What-if, Notes | Editable, with draft states |

**Why this matters commercially:** it turns the empty-canvas problem into an
onboarding path. A writer with no draft has nothing to diagnose and no reason to
stay. A writer with a film they admire has a reason to open the app today, and
the structure they extract becomes the skeleton they write into.

**Draft states** (Scrivener-style) on every scene of an original project: draft →
developing → confirmed. Deliberately writer-set rather than inferred, because a
scene can be fully written and still unresolved, and only the writer knows which.
Rendered as a coloured spine on the card, so the board shows at a glance how much
of the script is actually settled.

**On other people's screenplays.** The user supplies the file; Plotkraft never
hosts or redistributes one. Analysis of a work the user already has is
commentary, and reference projects are read-only so the tool cannot become a
route to editing and republishing someone's script. The demo video still uses
original content only.

## 3. Feature set

### Core (validated by research)
- **Causality graph** — directed edges (causes / complicates / merely-follows) with one-line justification per transition.
- **Structural load score** — graph centrality; load-bearing scenes visually weighted, no-downstream-edge scenes flagged as cut candidates.
- **What-if re-run (hero feature)** — writer cuts/reorders a scene → agents re-run → orphaned payoffs, unexplained character knowledge, continuity breaks light up. Most agentic behavior; best 15-sec demo moment.
- **Accept / dismiss / disagree** on every flag — writer is the final judge; diagnostic, not oracle. Some "and then" transitions are intentional.
- Load score selects which 2–3 scenes get Veo previz.

### New features from pain-point research
| Feature | Pain addressed | Value / feasibility | Verdict |
|---|---|---|---|
| **Note reconciliation dashboard** — upload notes from multiple sources, auto-pin to scenes, flag contradictions between notes | #1 pain (note fatigue); nothing on market does it | HIGH / HIGH (text classification + pinning to existing cards) | **Build (Stage 2)** |
| **Character/world bible auto-extraction** — living bible of established facts; later scenes contradicting an earlier fact get flagged | #3 pain; mirrors script-coordinator job | HIGH / MED (Gemini extraction pass feeding Continuity agent) | **Build (Stage 2)** |
| **Craft agent (reference mode)** — upload a produced screenplay and get, per scene, the job it performs, the device that performs it, and one lesson that survives being lifted into another script | Nothing to diagnose in a finished film; the empty-canvas onboarding problem | HIGH / HIGH (one Flash pass, batched; reuses the whole ingest and canvas) | **Built (Aug 31)** |
| **Draft states on scenes** — draft / developing / confirmed, writer-set | Knowing what is actually settled in a working draft | MED-HIGH / HIGH | **Built (Aug 31)** |
| **Story Circle map** — every scene placed on Harmon's 8 steps; flags missing steps, a late threshold, and disproportionate acts ("Search is 41% of your pages") | #2 pain (structure), at an altitude the causal graph cannot reach | HIGH / HIGH (one Flash pass over the beat sheet we already have; no new infrastructure) | **Build (Stage 2)** |
| **Setup/payoff tracker** — setups never paid off, payoffs never set up | Subplot-dropped failure mode | MED-HIGH / MED (extension of causal edges) | Stretch |
| **Logline generator from causal graph** — refreshes as story changes (protagonist, goal, central "but") | #6 pain, freelance delight | MED / HIGH (cheap) | Stretch |
| **Canvas snapshot diff** — visual diff between drafts (scenes added/cut/reordered, edges broken) | #4 pain (version chaos) | MED / MED (Firestore snapshots) | Stretch |

### Explicitly NOT building
- **Prose generation** — low trust, WGA-sensitive, off-strategy, off-positioning.
- **Real-time concurrent editing (CRDTs/Yjs)** — WriterDuet/Arc own it; invisible in a 3-min video; steals agent time.
- **Comps benchmarking is first to cut** if time is short (Prescene parity, not differentiation) — cut it before note reconciliation (unique).

## 4. UI — canvas-first (writers' room corkboard)

- Scene cards as custom nodes on an infinite canvas; transition type (therefore/but/and-then) as labeled custom edges; minimap + zoom.
- Layout: infinite canvas center, right-side toolbar/inspector, logs/activity strip bottom.
- Click node → side panel: research citations, continuity flags, pinned notes, comments.
- Drag node out → what-if mode: broken downstream beats highlighted.
- Load-bearing scenes visually weighted (size/heat color).
- Parallel citations rendered prominently — both for writer trust and for judges/Stage-One viability screen.

### Collaboration tiers
| Tier | What | Decision |
|---|---|---|
| 1 | Async annotations: shared project link, comments pinned to scene nodes, badges on cards | **Build** (~1 day) — freelancers' virtual room |
| 2 | Live presence cursors with names/colors | Stretch (~0.5 day) — big Design-criterion payoff in demo |
| 3 | True concurrent editing (CRDTs/Yjs) | **Skip** |

## 5. Demo design (≤3-min video)

- Show agents actually working, not a cinematic trailer (rules requirement).
- Hero moment: drag a scene out → downstream beats light up red (what-if re-run, ~15 sec).
- Collab moment: two browser windows side by side, comment appears live.
- Efficiency line: "a structure pass that took a $300 coverage service two weeks — in ninety seconds, on every draft."
- Give the therefore/but visualization ~10 seconds of named screen time ("Story Logic agent").
- Sample script must be original content — no third-party IP in the video.

## 6. Judging criteria mapping

| Criterion | How we hit it |
|---|---|
| Technological Implementation | Multi-agent orchestration; Parallel + Gemini + Veo genuinely called at runtime |
| Design | Canvas-first complete product; annotations + (stretch) live cursors; polished demo flow |
| Potential Impact | Research-validated pains: note fatigue (#1), structure (#2), continuity (#3); freelancers get a $0 always-on diagnostic room vs. $60–$1,500 coverage; diagnostic-not-oracle framing |
| Quality of the Idea | Two frameworks writers already argue about, made executable: the South Park "therefore/but" test for micro joints and **Harmon's Story Circle for macro shape** — plus note-contradiction detection (unserved) and Veo previz of load-bearing beats. Memorable, non-obvious, on-theme, and native to the craft rather than generic AI analysis |
