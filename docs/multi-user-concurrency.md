# Multi-user concurrency — gameplan

Phased plan for making TechLib work well when several people are signed into the **shared library** at once.

**Goals (in priority order):**

1. **Don’t confuse each other** while editing the same note (silent overwrites, stale drafts).
2. **Stay fast** — prefer incremental sync and soft locks over full reloads or heavy co-editing.

This doc is the living checklist. When a phase ships, mark it done and add a short entry under [Changelog](#changelog). Do **not** treat later phases as required just because they are listed here.

Related product context: shared workspace roles live in `supabase/migrations/001_workspace_roles.sql` and author-scoped edits in `006_note_created_by.sql`. Image-wall speed is tracked separately in [`image-loading-performance.md`](./image-loading-performance.md).

---

## Current state (baseline)

As of this gameplan’s creation:

| Area | Behavior |
|---|---|
| Library | One shared workspace; members see the same notes/labels/types/images |
| Roles | **viewer** read-only; **editor** mutates only notes they created; **admin** mutates any |
| Personal | Cart and reaction *rows* are per signed-in user |
| Client data | Full `refresh()` on login; then local React state |
| Live sync | **None** — no Realtime, no polling, no refetch on tab focus |
| Saves | Partial column updates; title/description on blur; **last-write-wins** (no version check) |
| Same-note awareness | **None** — no presence, no soft lock, no conflict UI |

**Who can collide on one note today?** Two admins, or an admin + the note’s author. Editors cannot edit each other’s notes (UI + RLS).

---

## Principles

- Keep-style notes do **not** need Google Docs CRDT co-editing of the body. Soft lock + version check + live wall is enough.
- Prefer **row patches** over calling full `listNotes()` again.
- Soft locks should fail open for speed (expire quickly) but fail closed for confusion (read-only or confirm take-over when a lease is active).
- Ship one phase at a time; measure how the floor team uses it before stacking the next.

---

## Phase 1 — Soft lock / presence on open

**Status:** Not started

**Why first:** Stops most “we both edited the same note” confusion with the smallest UX change.

### Intent

When someone opens the note editor:

1. Claim a short-lived lease: `note_id`, `user_id`, `expires_at` (≈ 30–60s).
2. Heartbeat while the editor stays open; release on close / tab hide.
3. Others see who is editing and open **read-only**, or confirm to take over.

### Implementation sketch

- Supabase Realtime **Presence** on a per-note or workspace channel, **or** a small `note_edit_locks` table (queryable + RLS).
- Show a quiet banner in the editor / on the card: “Editing: anna@…”.
- Admins still *can* take over; editors already blocked from others’ notes by authorship.

### Done when

- [ ] Opening a note advertises presence/lease to other clients
- [ ] Second opener sees who holds the note and cannot silently overwrite
- [ ] Lease expires if the holder crashes or leaves the tab
- [ ] No meaningful slowdown opening notes when alone

### Out of scope for this phase

Live wall updates, conflict merge UI, CRDT.

---

## Phase 2 — Optimistic concurrency on save

**Status:** Not started

**Why second:** Soft locks are not perfect (expired lease, two tabs, take-over). Saves must not clobber without a warning.

### Intent

Updates succeed only if the client still has the version it loaded:

```sql
UPDATE notes
SET …, updated_at = now()
WHERE id = $id AND updated_at = $clientKnownUpdatedAt
```

If 0 rows updated: fetch latest → show “Updated by someone else” → **Reload** / **Keep mine** (and optionally field-level merge later).

### Implementation sketch

- Thread `updatedAt` through `updateNote` (and label replace paths that race).
- On conflict, surface a small dialog in `NoteEditor` / `App` — not a full page reload unless the user chooses Reload.
- Treat wipe-and-rewrite label updates carefully (same version gate or transactional replace).

### Done when

- [ ] Stale saves cannot overwrite without user acknowledgment
- [ ] Happy path (sole editor) stays one round-trip, no extra lag
- [ ] Conflict path is understandable on phone and desktop

### Out of scope for this phase

Autosave cadence changes (optional follow-up after locks + versions exist).

---

## Phase 3 — Live wall sync (Realtime or focus sync)

**Status:** Not started

**Why third:** Library should feel multiplayer without forcing full reloads. Also avoids “I thought that note was still mine” after someone else archived/deleted it.

### Intent

Other users’ creates/edits/archives/deletes appear on the wall quickly.

Rules:

- **Wall:** apply remote patches freely.
- **Open editor:** if a field is dirty, do not overwrite the draft; show a subtle “Remote change” / refresh control.
- Prefer patching rows over full `listNotes()`.
- Safety net: light sync on `visibilitychange` / window focus if Realtime drops (`updated_at > lastSync`).

### Implementation sketch

- Supabase Realtime on `notes`, `note_images`, `note_labels` (and optionally types/labels/stock) scoped to the library owner.
- Debounce/coalesce bursts (e.g. many image inserts) so the wall does not thrash.
- Keep signed-URL cache hot; do not re-sign every image on every remote event.

### Done when

- [ ] Second browser sees another user’s new/edited note without a manual reload
- [ ] Open dirty editor is not clobbered by remote patches
- [ ] Focus/reconnect recovers if the socket was down
- [ ] Typical session does not re-run a full library hydrate on every remote change

### Out of scope for this phase

Full offline-first sync engine; CRDT body editing.

---

## Phase 4 — Reactions visibility (team counts)

**Status:** Not started

**Why fourth:** Product polish once collision + freshness are fixed. Today RLS on `reactions` is own-rows-only, so `listAllReactions` cannot show the team.

### Intent

If reactions should be social/team-visible:

- Members can **SELECT** all reactions on library notes.
- Writes stay personal (`owner_id = auth.uid()`).
- UI aggregates counts across users (and optionally shows who reacted later).

If product decision is “reactions stay private bookmarks,” document that here and skip implementation — mark phase cancelled with rationale.

### Done when

- [ ] Product decision recorded (team-visible vs personal-only)
- [ ] If team-visible: RLS + list/aggregate + UI counts match across two accounts
- [ ] Cart remains personal either way

---

## Phase 5 — Incremental sync / scale hygiene

**Status:** Not started

**Why last:** Speed under many concurrent users and larger libraries. Builds on Phase 3.

### Intent

- Incremental fetch: `WHERE updated_at > :cursor` (or rely on Realtime after first load).
- Avoid re-signing every image on refresh (keep `signedUrlCache` / wall-thumb path).
- Coalesce Realtime bursts; prioritize visible notes.
- Optional UX: show **author** on cards (`createdBy` → email) so people know whose note it is before opening.
- Optional: debounced autosave of title/description (~1–2s) *after* Phases 1–2, to reduce blur-race lost work.

### Done when

- [ ] Returning to the app rarely needs a full note list hydrate
- [ ] Many image uploads from one user do not stall every other client
- [ ] Wall stays responsive with a large shared library (qualitative OK with floor team)

### Out of scope for this phase

Rewriting the data model; multi-workspace / multi-tenant beyond the current single library.

---

## Explicitly deferred

| Idea | Why deferred |
|---|---|
| CRDT / OT co-editing of description | Heavy; Keep-like notes rarely need two people typing the same body |
| Multiple independent libraries / orgs | Product not there yet; one shared TechLib workspace |
| Migrating local IndexedDB notes into cloud | Separate migration problem |

---

## Suggested order (reminder)

1. Soft lock / presence  
2. `updated_at` check on save  
3. Realtime (or focus) wall sync  
4. Reactions SELECT / team counts (if desired)  
5. Incremental sync / scale hygiene  

---

## Changelog

Record shipped work here so later phases know what already landed.

| Date (Europe/Warsaw) | Phase | What changed | PR / commit |
|---|---|---|---|
| 2026-10-24 | — | Gameplan created (baseline documented; no code changes) | — |

<!--
Example row after a phase ships:
| 2026-11-02 | 1 | Soft locks via note_edit_locks + editor banner | #123 / abcdef0 |
-->
