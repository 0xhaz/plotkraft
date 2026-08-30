# Plotkraft — System Architecture & Build Plan (DRAFT)

> Part of the Plotkraft doc set: design.md (what & why) · techstacks.md (tools & SDKs) · **architecture.md** (this file — system & build plan).
> Hackathon: Agentic Cinema, Parallel track. Deadline: Sep 7, 2026, 2:00 PM PT (banner says Sep 9 — unresolved, confirm with janet@devpost.com).

## 1. Agent crew

| Agent | Role | Key tools |
|---|---|---|
| **Researcher** | Fact-checks real-world references in the script (locations, brands, historical/legal/medical/technical accuracy) with cited sources | Parallel Search + Extract |
| **Continuity** | Builds scene graph: characters, props, timeline; flags contradictions across scenes. Feeds off the auto-extracted character/world bible | Gemini reasoning over parsed script |
| **Story Logic (Causality)** | Applies the Parker/Stone "therefore/but" rule: classifies every beat transition as *therefore* (causal), *but* (adversative), or *and then* (merely sequential); flags weak joints | Gemini classification over beat sheet |
| **Story Circle (Structure)** | Maps every scene onto Dan Harmon's 8-step circle (You/Need/Go/Search/Find/Take/Return/Change); reports missing steps, mis-ordered steps, and disproportionate ones ("Search runs 41% of your pages"). Macro complement to Story Logic's micro joints | Gemini classification over the beat sheet |
| **Notes** | Ingests pasted/uploaded notes from multiple sources (producer, exec, peer, coverage), maps each note to affected scene(s), pins to canvas cards, flags where two notes contradict each other | Gemini classification + canvas pinning |
| **Comparables** | Pulls live data on comparable films, genre beat-structure norms ("comps hit first reversal by p.12, yours at p.31"), festival/box-office context | Parallel Search API |
| **Previz** | Two tiers: **Imagen 3 storyboard panels** for many scenes (cheap, fast — explicitly pitched in hackathon resources) + **Veo animatic clips** for the 2–3 top load-bearing scenes | Vertex AI Imagen 3 + Veo |
| **Table Read** (stretch) | "Hear this scene" — multi-speaker Gemini TTS reads the dialogue aloud (writers validate dialogue by ear; mirrors real table reads) | Gemini TTS multi-speaker |

Orchestration: Gemini function-calling orchestrator (`@google/genai`); agents run as tool-equipped sub-calls. Working skeleton: `researcher-agent-spike.ts` (type-checked plan→search→extract→synthesize loop).

## 2. System diagram

```
Next.js (React Flow canvas, Firebase Auth — Google provider)
        │
        ▼
NestJS API on Cloud Run
        │
        ├── Gemini orchestrator (@google/genai)
        │     ├── docParse        → Gemini multimodal (PDF/Fountain script)
        │     ├── parallelSearch  → parallel-web TS SDK (Researcher, Comparables)
        │     ├── causalityPass   → Gemini (Continuity, Story Logic)
        │     ├── circlePass      → Gemini (Story Circle: 8-step structural map)
        │     ├── bibleExtract    → Gemini (character/world bible)
        │     ├── notesPass       → Gemini (note mapping + contradiction flags)
        │     ├── imagenBoards    → Vertex AI Imagen 3 (storyboard tier)
        │     └── veoGenerate     → Vertex AI Veo (hero-scene animatics)
        │
        ├── Firestore   → projects, scene graph, bible, notes, annotations, snapshots
        ├── Firebase RTDB → presence cursors + soft-lock markers (Tier 2)
        ├── Cloud Storage → scripts, Veo clips, Imagen boards
        └── Secret Manager → Parallel API key
```

## 2b. Two altitudes of structure

Story Logic and Story Circle answer different questions, and a writer needs both:

| | Story Logic (therefore/but) | Story Circle (Harmon) |
|---|---|---|
| Altitude | The joint between two beats | The shape of the whole script |
| Catches | "Scene 7 merely follows scene 6" | "Nothing in your script pays a price" |
| Fails to catch | A perfectly-causal script with no second act | A well-shaped script made of limp joints |
| Cost | One Flash pass over transitions | One Flash pass over the same beat sheet |

The circle also carries an **order/chaos axis** that the canvas can render directly:
steps 1–2 and 7–8 sit in the ordered world, 3–6 in chaos, with threshold crossings
at **Go** (3) and **Return** (7). Those two crossings are the most diagnosable
moments in a screenplay — a late **Go** *is* the slow-start note, and a compressed
**Return** *is* the rushed-ending note, both stated as page positions rather than vibes.

Diagnostics worth shipping (each is a flag, accept/dismiss like any other):

- **Missing step** — "No scene pays a price (step 6, Take). Your protagonist gets what they want for free."
- **Disproportionate step** — "Search occupies 41% of your pages; the convention is ~25%." This is the sagging-Act-2 note, quantified.
- **Late threshold** — "You cross into chaos at page 31 of 110 (28%); convention is ~12%."
- **Compressed return** — "Steps 7–8 occupy 4% of pages: the transformation is asserted, not dramatised."

Two things fall out of this cheaply:

- **Previz targeting improves.** Load score says which scenes carry weight; the circle
  says which carry *meaning*. A scene that is both load-bearing and the **Take** is the
  obvious candidate for a Veo clip — better than load score alone, which cannot tell a
  structurally central scene from a merely well-connected one.
- **Comparables gets a spine.** The Comparables agent's pitch ("comps hit the first
  reversal by p.12, yours at p.31") needs a normalised position to compare *against*.
  The circle supplies exactly that, turning a stretch feature into a lookup.

## 3. Agent efficiency design

The efficiency pitch: agents collapse the writer's three slowest loops — feedback (weeks of coverage turnaround → minutes, ~$0 marginal vs. $60–$1,500), revision (what-if simulates a cut *before* the writer breaks downstream scenes; load scores direct limited revision time to load-bearing weak joints), and admin (note mapping, bible upkeep, fact-checking absorbed by agents).

System mechanisms that deliver it (also the Technological Implementation story):

| Mechanism | What | Why |
|---|---|---|
| **Incremental re-analysis** | On edit, mark the dirty subgraph (edited scene + causally-downstream nodes) and re-run agents on that slice only — the causality graph *is* the dependency map | What-if feels instant; token cost stays low enough to run on every save |
| **Parallel agent execution** | Researcher, Story Logic, bible extraction are independent passes — fire concurrently, stream results onto canvas as each lands | Progressive flags instead of a spinner |
| **Model routing** | Gemini Flash for high-volume cheap calls (beat-transition classification, note mapping); Pro for deep continuity reasoning over the full bible | Full-script pass affordable on every save |
| **Proactive background passes** | While the writer edits, quietly re-check dirty scenes and update canvas badges — "colleague who's already read your pages" | Most agentic behavior in the product; hackathon judges agents |
| **Dismissal learning** | Dismissed flags are signal: writer dismisses "and then" flags on breather scenes twice → stop flagging that pattern for this project (per-project suppression rules in Firestore) | An agent that repeats rejected notes gets ignored; respecting dismissals keeps flags read |

## 4. Concurrency & multi-user data integrity

Principle: get multiplayer safety from **data-model design**, not CRDTs (collab Tier 3 stays skipped). Stale edits must be *rejected visibly*, never overwrite silently.

| Mechanism | What | Conflict class it kills |
|---|---|---|
| **Fine-grained docs** | One Firestore doc per scene / edge / annotation / flag — never one big canvas doc | Two people editing *different scenes* can't conflict at all |
| **Append-only collections** | Comments, annotations, agent flags, dismissals = new docs in subcollections (`scenes/{id}/annotations/{id}`), never edits to shared fields | Simultaneous comments coexist; most collab activity is annotation-shaped |
| **Field-level updates** | `update({position})`, never `set()` of whole doc; position moves = last-write-wins (harmless) | Card move + summary edit on same scene both land |
| **Optimistic versioning** | Scene doc carries `version`; edits run in a Firestore transaction (check version → increment → write); mismatch → visible "updated by Maya — review & retry" with fresh content | Same-field same-doc edits (the one real conflict) — rejected loudly, not lost |
| **Soft-lock presence** | Opening a scene's edit panel writes ephemeral "editing" marker (RTDB + `onDisconnect` cleanup); others see "Noah is editing" on the card | Prevents most same-field conflicts from being attempted; no stranded hard locks |
| **Agents in their own lane** | Agent output lives in separate subcollections/fields humans never edit; agents never mutate writer-authored content; what-if runs on ephemeral in-memory graph copy, not shared state; flags stamp the scene `version` analyzed → stale flags render "possibly stale — re-run" | Human/agent overwrite structurally impossible; one user's what-if doesn't mutate everyone's canvas |
| **Live listeners + snapshots** | `onSnapshot` on project keeps every canvas seconds-fresh (conflicts mostly come from stale views); canvas snapshots (the draft-diff feature) double as restore escape hatch | Shrinks conflict window to near zero; recovery story if anything slips through |

**Week-one data-model prerequisites** (painful to retrofit): stable scene IDs + stored edge lists (dirty-subgraph computation), `version` field on scene docs, append-only subcollection layout, flag-suppression collection (dismissal learning).

## 5. Reliability fallbacks

- Gemini causal-edge labeling unreliable on a real 100-page script → writer-confirmed edges (human-in-the-loop).
- Story Circle step assignment ambiguous on non-linear or ensemble scripts → present as a *reading* the writer can re-assign by dragging a scene to another step, never as a verdict. Report proportions (which are robust) even when individual assignments are uncertain.
- Contradiction detection high false-positive rate → ship as "flags to review," lead demo with causality instead.
- Veo latency/cost blocks iteration → pre-generate + cache all demo clips (default posture anyway); Imagen storyboard tier carries previz breadth.
- Parallel credits run low → cache aggressively, cap calls, `mode: 'basic'` everywhere interactive.

## 6. Scope ladder (solo, ~2.5 weeks as written — COMPRESS if build starts now; see open questions)

1. **Spine:** upload script → Gemini parse → causality graph on React Flow canvas + load scores + what-if re-run; one Parallel search with visible citations, end-to-end on Cloud Run. Request $100 GCP credits immediately (form deadline Aug 31).
2. **Continuity + notes:** contradiction checking, character-bible auto-extraction, **note reconciliation dashboard**.
3. **Trust + polish:** Researcher cited fact-checking prominent in UI; 2–3 cached Veo clips + Imagen boards; Tier 1 annotations.
4. **Stretch:** Tier 2 cursors; setup/payoff tracker; logline generator; snapshot diff; Comparables; Gemini TTS table read.
5. **Polish + submit a full day early** (deadline ambiguity).

If starting Aug 30 against a Sep 7 deadline (8 days): spine days 1–4, continuity+notes days 5–6 (note-reconciliation *or* bible, not both), previz+polish day 7, submit day 8. Most stretch items die.

## 7. Open questions

- [ ] Confirm true deadline (Sep 7 vs Sep 9) with hackathon manager — determines whether the compressed 8-day ladder applies.
- [ ] GCP credits form — **due Aug 31**.
- [ ] One polished sample script for the demo (original content only — no third-party IP in the video). Don't leave for the last day.
- [ ] Fountain vs PDF-first ingest — lean Fountain-first on the compressed timeline (trivially parseable); PDF via Gemini multimodal as stretch.
- [ ] plotkraft.com registration + trademark/collision checks (see design.md §1).
- [ ] Verify current Prescene feature set before finalizing demo positioning claims (see design.md §2).
