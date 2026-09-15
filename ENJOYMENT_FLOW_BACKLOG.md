# Enjoyment & Flow Backlog

Ranked ideas to make TechLib more enjoyable by borrowing **flow**, **game-loop**, and **light social** mechanics — aimed at warehouse competence, not doomscrolling.

**North star:** every common job should feel like a short combo with a clear win  
`find → open/capture → update → wall/cart → done`

**Do not build:** guilt streaks, infinite feeds, XP with no ops meaning, notification FOMO.

---

## Current surface map

| Surface | Role in the loop |
| --- | --- |
| **App shell / top bar** | Brand, search, view prefs — entry to Browse |
| **Sidebar** | Notes / Archive / Cart, labels, types, stock, dispositions, special cases — filter & identity |
| **Note wall (`NoteGrid` + `NoteCard`)** | Browse loop — visual scan & recognition |
| **Note editor** | Capture / enrich loop — title, body, images, labels, guidelines, reactions, color |
| **Cart (`CartView`)** | Use loop — pull list climax |
| **Paste import** | Bulk capture — power-user mastery |
| **Undo toast** | Safety net — reduces anxiety, supports flow |
| **Auth gate** | First impression / brand |

---

## Ranked backlog

Priority = impact on daily enjoyment ÷ implementation risk.  
Effort: **S** small · **M** medium · **L** larger.

### P0 — Highest leverage (do first)

| ID | Idea | Screens | Loop | Why it feels good | Effort |
| --- | --- | --- | --- | --- | --- |
| E1 | **Juicy micro-feedback** on pin, color, add-to-cart, reaction, label chip toggle (short motion + optional subtle scale) | Editor, Card, Cart | All | Games call this “juice”; makes commits feel physical | S |
| E2 | **Capture combo polish** — camera/gallery → card appears on wall with a brief highlight pulse | Editor → Wall | Capture | Fastest path from reality → library is the core dopamine hit | M |
| E3 | **Cart win state** — clear unit/line counts, satisfying empty→filled progress, strong print/done moment | Cart, Sidebar badge | Use | Completing a pull should feel like finishing a level | S–M |
| E4 | **Search as telepathy** — instant results, highlight match on card title/labels, easy clear, recent queries | Top bar, Wall | Browse | Variable reward of “found it” without feed addiction | M |
| E5 | **Extend undo** to more reversible actions (archive, label assign, cart clear) with the same toast pattern | Global | All | Removes fear → people move faster | M |

### P1 — Flow & tidy-up quests (no XP)

| ID | Idea | Screens | Loop | Why it feels good | Effort |
| --- | --- | --- | --- | --- | --- |
| E6 | **Work queues / “tidy targets”** as sidebar filters: no photo, no guidelines, unlabeled, special-case only (special-case already exists) | Sidebar, Wall | Browse → Capture | Clear goals create flow; optional missions without gamification theater | M |
| E7 | **Recently useful** ordering option (recently opened / edited) alongside default | Wall, View prefs | Browse | “Continue watching” for parts — recognition reward | M |
| E8 | **Image-first wall density** when photos exist; text-first when not — stronger visual hierarchy | Card, View prefs | Browse | Social/media apps win on visual scan; keep wall alive | M |
| E9 | **Empty / filtered states with one CTA** (“Add photo notes”, “Paste parts”, “Clear filters”) | Wall, Cart | Browse / Use | Empty states that invite the next action beat dead ends | S |
| E10 | **Editor save confidence** — quiet “Saved” / sync pulse; never block typing | Editor | Capture | Immediate feedback without breaking focus | S |

### P2 — Mastery & power-user depth

| ID | Idea | Screens | Loop | Why it feels good | Effort |
| --- | --- | --- | --- | --- | --- |
| E11 | **Keyboard / gesture mastery cheatsheet** (discoverable, not modal-heavy): arrows between notes, Esc/Back layers, multi-select | Editor, Wall | Mastery | Easy to learn, hard to master | S |
| E12 | **Bulk “enrich” flows** — multi-select → add label / guideline / type / stock (partially present via drag-assign & bulk guidelines) | Wall, Sidebar | Capture | Combo multipliers for experts | M |
| E13 | **Paste import delight** — preview already exists; add success confetti-lite (subtle), count summary, undo (if not already) | Paste dialog | Capture | Bulk create should feel powerful, not scary | S |
| E14 | **Barcode scan-to-find** (device camera → jump to matching title) | Top bar / Wall | Browse / Use | Instant competence on the floor | L |

### P3 — Light social (warehouse language)

| ID | Idea | Screens | Loop | Why it feels good | Effort |
| --- | --- | --- | --- | --- | --- |
| E15 | **Reaction semantics** — map emojis to ops meaning (tricky / verified / hot / damaged) via labels or tooltips; keep one-tap | Editor, Card | Social | Reactions become status language, not vanity | S |
| E16 | **Contribution freshness** — subtle “updated” / “photo added” cue on cards | Card | Social | Library feels alive without a feed | M |
| E17 | **Share / copy utilities** — copy part #, copy barcode value, share note link, print single note | Editor, Cart | Use | Social *utility*, not likes | M |
| E18 | **Label boards as identity** — stronger active-filter chrome so “HP + POS” feels like a curated shelf | Sidebar, Top bar | Browse | Collection identity (Pinterest/Keep boards) | S–M |

### P4 — Later / only if multi-user intensifies

| ID | Idea | Screens | Notes | Effort |
| --- | --- | --- | --- | --- |
| E19 | Activity of *knowledge* (“Alex added guidelines”) not vanity metrics | Card / optional tray | Requires authorship metadata | L |
| E20 | Team “verify this part” lightweight request | Editor | Only with real multi-user workflow | L |
| E21 | Streaks / points / leaderboards | — | **Skip** for this product | — |

---

## Suggested implementation order

1. **E1 → E3 → E9 → E10** — juice + cart climax + calm empty/save (fast feel upgrade)  
2. **E5 → E2 → E4** — undo safety, capture highlight, search delight  
3. **E6 → E7 → E8** — quests + smarter wall  
4. **E15 → E18 → E11 → E12** — meaning + mastery  
5. **E14 / E16 / E17** when floor workflow needs them  

---

## Design principles (keep these)

1. **One job per moment** — don’t stack badges, stats, and promos on the wall.  
2. **Feedback > features** — prefer polishing existing actions over adding systems.  
3. **Optional quests, never guilt** — tidy targets are filters, not streaks.  
4. **Warehouse words** — verified, special case, pull, bay — not “level up.”  
5. **Reversible by default** — undo is an enjoyment feature.  

---

## Mapping to the three loops

```text
Browse:  Shell search + Sidebar filters + Note wall
         ↑ E4 E6 E7 E8 E9 E18

Capture: Note editor + images + paste
         ↑ E1 E2 E5 E10 E13 E12

Use:     Cart + print + find-on-floor
         ↑ E3 E14 E17
```

---

## Out of scope for this doc

- Renaming TechLib (separate decision; candidates included PartsKeep / PartsBay / Partsy).  
- Changes to `PROJECT_PLAN.md` (living architecture plan stays authoritative for structure).  
- Implementing the items above — this file is the ranked backlog only.
