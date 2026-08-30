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
| Quality of the Idea | "South Park writers' room causality test as an agent" + note-contradiction detection (unserved) + Veo previz of load-bearing beats — memorable, non-obvious, on-theme |
