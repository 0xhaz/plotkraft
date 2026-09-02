# Storyboard pivot — validation & architecture

> Doc set: design.md · techstacks.md · architecture.md · workplan.md · DEMO.md · **storyboard-arch.md** (this file).
> Written Sep 3, 2026. **Deadline Sep 7, 2:00 PM PT — four days.** Read §6 before §7.

Proposal: stop trying to help writers *develop* a screenplay and focus on the next
phase — turning a finished screenplay into a storyboard, with the story graph as a
mind map for tracking which scenes still need work.

This document tests that idea against the market before we build on it.

---

## 1. Is the pain real?

Yes, and it is well documented.

| Pain | Evidence |
|---|---|
| **Time** | Professional-quality frames take entire days per sequence — time indie directors need for scouting, casting and fundraising |
| **Cost** | Professional storyboard artists are simply unaffordable on low-budget productions, which fall back to shot lists |
| **Revisions** | When a producer or DP asks for changes, manual boarding means restarting whole sequences; the revision cycle delays schedules and strains the team |
| **The cost of skipping** | Productions that skip boarding to "save time" lose hours on set arguing about camera angles |

There is also a real counter-argument worth recording: boarding **too early** can
over-fix a scene in the director's head, making it harder to see alternatives later.
That matters for us — it argues for boarding *selectively*, not exhaustively.

## 2. Is the space open? **No. This is the finding that should change the plan.**

"Script in, storyboard out" is not an unserved idea. It is a funded, shipping,
crowded category:

| Tool | Position | Price (Jul 2026) |
|---|---|---|
| **Katalist AI** | Script → boards with character consistency as the headline feature | from $19/mo |
| **LTX Studio** | Script → frames, aimed at previz: lenses, camera moves, shot lists | from $35/mo |
| **Boords** | Production workflow, approvals, now with AI generation added | from $50/mo |
| **Storyboarder.ai** | Script → boards | from $45/mo |
| **Atlabs** | Script → boards | free, paid from $15/mo |

Plus Studiovity, story-boards.ai, drawstory, Story2Board, M Studio and others
publishing actively in 2026.

**Katalist in particular is the proposed pivot, already built and funded.** Building
"an AI engine that creates a prompt from the screenplay and generates a storyboard"
would put us in direct feature parity with a product that has a head start and a
paying user base — and we would arrive with four days of runway.

## 3. The hard technical problem we would be inheriting

**Character consistency is the single biggest complaint** about AI storyboarding.
Image models process each prompt independently, so faces, clothing and lighting
drift between panels. A board of 50 frames yields 50 slightly different versions of
the same person, and that breaks the one thing a board is for — letting a producer
read a sequence as continuous.

This is the axis buyers judge these tools on, competitors have spent real
engineering on it, and we have not started. Our current panels deliberately draw
*anonymous figures* precisely to sidestep it. Competing on their strongest axis,
from zero, in four days, is not a plan.

## 4. Where there IS a real gap — and we are unusually placed to fill it

Two problems recur in the research that none of the tools above appear to solve,
because solving them requires understanding the *story*, not just rendering prompts:

**(a) "The script changed — which boards are now wrong?"**
The revision cycle is named repeatedly as the core pain. The standard advice is to
"re-board only the affected scenes" — but every existing tool leaves the writer to
work out which those are. On a 60-scene script after a structural rewrite, that is
guesswork.

**We already compute this exactly.** The what-if engine's dirty-subgraph walk
takes a changed scene and returns everything causally downstream of it. Point that
at panels instead of flags and it becomes: *"you changed scene 12; panels 14, 19
and 23 are now stale."* No competitor has a causal graph, so none of them can
answer this.

**(b) "Which scenes should I board at all?"**
Boarding a whole feature is expensive and, per §1, can over-fix the film too early.
Existing tools board everything or leave selection to the user.

**We already compute this too.** Panel selection ranks by load score crossed with
Story Circle position, damping the long middle and favouring the beats that turn
the film, then spreads picks across the script so the board shows its shape.

That reframes the product from *"AI makes your storyboard"* — crowded — to
**"your storyboard knows what your story is doing"**: board what matters, and know
what went stale when you rewrote. That is differentiated, defensible, and mostly
already built.

## 5. What exists versus what a pivot needs

| Capability | State |
|---|---|
| Fountain + PDF ingest, 244-scene feature parsed | ✅ built |
| Scene graph, acts, named sequences — the mind map | ✅ built |
| Canvas with collapsible act/sequence navigation | ✅ built |
| Panel generation (`gemini-2.5-flash-image`) | ✅ built, 6/6 panels in 53s |
| Structure-aware panel selection | ✅ built, tested |
| Dirty-subgraph engine (the staleness answer) | ✅ built, tested — **not yet pointed at panels** |
| Panels shown on the canvas | ❌ generated and stored, never rendered in the UI |
| Panel staleness marking | ❌ ~2h using the existing walk |
| Shot type / camera direction per panel | ❌ new pass |
| Character consistency | ❌ hard, competitors' strongest axis |
| Veo motion | ❌ **no access on this project** (architecture.md §4b) |

## 6. Timeline reality — read this before deciding

Four days remain, and the blocking work is not code:

- No deployed URL. **Nothing built is visible to a judge until this exists.**
- No README with runtime-evidence pointers.
- No video.
- Google sign-in provider not enabled in the Firebase console — nobody but the owner can sign in.
- Veo access not requested.

A full repositioning — new landing page, new demo, new narrative — competes
directly with that list. The recommendation is therefore **not** to choose between
the two ideas but to narrow the framing:

> Keep everything built. Add the two things that make it a storyboard product —
> render panels on the canvas, and mark them stale when the story changes. Lead the
> demo with boards instead of diagnosis.

That is roughly **half a day of work**, uses only what exists, and lands on the
differentiated position rather than the crowded one.

## 7. Architecture, if we proceed

Nothing below requires a new service; it is three additions to what runs today.

### 7.1 Panels on the canvas
Scene cards carry `boardPath`. Render the thumbnail in the card and the full panel
in the scene panel. Firebase Storage `getDownloadURL` handles auth. **~2h.**

### 7.2 Panel staleness — the differentiator
On a scene edit, `version` already increments. Store `boardVersion` alongside
`boardPath`; a panel whose `boardVersion` is behind the scene's `version` is
directly stale. Then run the existing dirty-subgraph walk from that scene and mark
panels of causally-downstream scenes **consequentially stale** — a weaker claim,
shown differently, because the panel is not wrong, its context is.

```
scene 12 edited  →  panel 12 stale (its own content changed)
                 →  dirty subgraph = {14, 19, 23}
                 →  panels 14, 19, 23 flagged "story changed upstream"
```

Re-board acts on that selection. **~2h**, mostly pure logic, testable without a
model call.

### 7.3 Shot direction per panel
One Flash pass per scene returning shot size, angle and a one-line staging note,
fed into the image prompt and shown under the panel. Turns a picture into a board
a DP can read. **~2h.**

### 7.4 Explicitly not building
- **Character consistency.** Competitors' strongest axis; we would arrive last. Keep drawing anonymous figures and say so — a board is about staging.
- **Veo motion.** No access. Do not claim it.
- **Shot lists, stripboards, sides, scheduling.** Production-office work, downstream of us, and StudioBinder owns it.

## 8. Verdict

The pain is real and the pivot's *instinct* is right — storyboarding is a sharper,
more visual, more demoable problem than development diagnosis.

But "AI turns your script into a storyboard" is the crowded description of it, and
the one axis those competitors win on is the one we have not started. The version
worth building is the one only we can: **a storyboard that understands the story
underneath it** — selective about what it draws, and honest about what your rewrite
just invalidated.

That needs about half a day, not a rebuild. Everything else in the four days should
go to deployment, README and video, because none of this counts until a judge can
open a URL.
