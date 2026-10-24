# Multi-user concurrency — gameplan

Phased plan for making TechLib work well when several people are signed into the **shared library** at once.

**Goals (in priority order):**

1. **Don’t confuse each other** while editing the same note (silent overwrites, stale drafts).
2. **Stay fast** — prefer incremental sync and soft locks over full reloads or heavy co-editing.

This doc is the living checklist. When a phase ships, mark it done and add a short entry under [Changelog](#changelog). Do **not** treat later phases as required just because they are listed here.

Related product context: shared workspace roles live in `supabase/migrations/001_workspace_roles.sql` and author-scoped edits in `006_note_created_by.sql`. Image-wall speed is tracked separately in [`image-loading-performance.md`](./image-loading-performance.md).

---

## Current state (shipped collaboration)

| Area | Behavior |
|---|---|
| Library | One shared workspace; members see the same notes/labels/types/images |
| Roles | **viewer** read-only; **editor** mutates only notes they created; **admin** mutates any |
| Personal | Cart is per signed-in user; reaction *writes* are personal, *counts* are team-visible (Phase 4; UI gated by `SHOW_REACTIONS`) |
| Client data | Full `refresh()` on login; then local React state |
| Live sync | Realtime wall patches + focus/reconnect incremental sync (Phase 3) |
| Saves | Partial column updates; title/description on blur; **versioned** editor saves (Phase 2) |
| Same-note awareness | Soft edit locks (Phase 1) + conflict dialog on stale save (Phase 2) |
| Author on cards | Short label from `createdBy` (“you” / email local-part); `SHOW_NOTE_AUTHOR` |

**Who can collide on one note today?** Two admins, or an admin + the note’s author. Editors cannot edit each other’s notes (UI + RLS).

### Collaboration UX (enjoyable multiplayer)

What the floor team should *feel* while sharing TechLib:

| Feature | Status | Notes |
|---|---|---|
| Soft lock / “Editing: name” | Shipped (Phase 1) | Deploy `007_note_edit_locks.sql` |
| Stale-save conflict dialog | Shipped (Phase 2) | Reload / Keep mine |
| Live wall updates | Shipped (Phase 3) | Deploy `008_realtime_library_tables.sql` |
| Team reaction counts | Shipped (Phase 4), **UI off** | `SHOW_REACTIONS = false`; deploy `009` |
| **Author on wall cards** | **Shipped** | `SHOW_NOTE_AUTHOR`; deploy `010_library_member_labels.sql` |
| **Remote-change wall pulse** | **Shipped** | `SHOW_REMOTE_WALL_PULSE`; soft ring on cards others just changed |
| **Online “who’s here” strip** | **Shipped** | `SHOW_ONLINE_PRESENCE`; Realtime Presence under topbar when ≥1 other member is connected |
| Debounced autosave | Idea (Phase 5 optional) | Fewer blur races |

Flip flags in `src/lib/config.ts`. SQL steps are listed in `supabase/README.md`.

---

## Principles

- Keep-style notes do **not** need Google Docs CRDT co-editing of the body. Soft lock + version check + live wall is enough.
- Prefer **row patches** over calling full `listNotes()` again.
- Soft locks should fail open for speed (expire quickly) but fail closed for confusion (read-only or confirm take-over when a lease is active).
- Ship one phase at a time; measure how the floor team uses it before stacking the next.

---

## Phase 1 — Soft lock / presence on open

**Status:** Implemented (pending deploy of `007_note_edit_locks.sql`)

**Why first:** Stops most “we both edited the same note” confusion with the smallest UX change.

### Intent

When someone opens the note editor:

1. Claim a short-lived lease: `note_id`, `user_id`, `expires_at` (≈ 30–60s).
2. Heartbeat while the editor stays open; release on close / unload.
3. Others see who is editing and open **read-only**, or confirm to take over.

### Implementation sketch

- Table `note_edit_locks` + RPCs (`claim_note_edit_lock`, `heartbeat_note_edit_lock`, `release_note_edit_lock`, `get_note_edit_lock`) in `007_note_edit_locks.sql`.
- Client: `src/lib/noteEditLock.ts`, `src/lib/useNoteEditLock.ts`; wired from `App.tsx` into `NoteEditor` banner + read-only.
- Realtime `postgres_changes` on the lock row; 45s TTL, 15s heartbeat.
- Network failures **fail open** (solo edit still works); a live foreign lease **fails closed** (view only + Take over).

### Done when

- [x] Opening a note advertises presence/lease to other clients
- [x] Second opener sees who holds the note and cannot silently overwrite
- [x] Lease expires if the holder crashes or leaves the tab
- [x] No meaningful slowdown opening notes when alone

### Out of scope for this phase

Live wall updates, conflict merge UI, CRDT.

---

## Phase 2 — Optimistic concurrency on save

**Status:** Implemented

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

- Notes carry `updatedAtIso` (exact Postgres timestamptz) for precise `WHERE` matches.
- `updateNote(id, patch, { expectedUpdatedAtIso | force })` — editor saves are versioned; bulk/undo may omit the check.
- Per-note save queue avoids false conflicts when title + description blur together.
- Optimistic UI updates content fields only (does not bump `updatedAt` until the server confirms).
- `SaveConflictDialog`: Reload (adopt server + remount editor) / Keep mine (force overwrite) / Cancel.

### Done when

- [x] Stale saves cannot overwrite without user acknowledgment
- [x] Happy path (sole editor) stays one round-trip, no extra lag
- [x] Conflict path is understandable on phone and desktop

### Out of scope for this phase

Autosave cadence changes (optional follow-up after locks + versions exist).

---

## Phase 3 — Live wall sync (Realtime or focus sync)

**Status:** Implemented (pending deploy of `008_realtime_library_tables.sql`)

**Why third:** Library should feel multiplayer without forcing full reloads. Also avoids “I thought that note was still mine” after someone else archived/deleted it.

### Intent

Other users’ creates/edits/archives/deletes appear on the wall quickly.

Rules:

- **Wall:** apply remote patches freely.
- **Open editor:** if a field is dirty, do not overwrite the draft; show a subtle “Remote change” / refresh control.
- Prefer patching rows over full `listNotes()`.
- Safety net: light sync on `visibilitychange` / window focus if Realtime drops (`updated_at > lastSync`).

### Implementation sketch

- Migration `008_realtime_library_tables.sql` publishes notes / images / labels / types / stock / links.
- `useLiveLibrarySync` coalesces `postgres_changes` → `fetchNotesByIds` / meta list refresh.
- `mergeRemoteNotesIntoWall` patches local state; preserves signed URLs; drops soft-deletes.
- `listNotesChangedSince` on tab visible / Realtime re-subscribe (skips first connect).
- NoteEditor banner: “Updated elsewhere” + Reload (remount) when drafts diverge from a newer server version.

### Done when

- [x] Second browser sees another user’s new/edited note without a manual reload
- [x] Open dirty editor is not clobbered by remote patches
- [x] Focus/reconnect recovers if the socket was down
- [x] Typical session does not re-run a full library hydrate on every remote change

### Out of scope for this phase

Full offline-first sync engine; CRDT body editing.

---

## Phase 4 — Reactions visibility (team counts)

**Status:** Implemented (pending deploy of `009_team_reactions.sql`)

**Product decision:** **Team-visible.** Reactions are shared across the library so the floor team sees the same counts. Cart stays personal.

**UI currently off:** `SHOW_REACTIONS = false` (and `SHOW_SORTED` follows it). Plumbing, RLS, and aggregation stay; flip the flag to restore UI + fetch/live-sync.

**Why fourth:** Product polish once collision + freshness are fixed. Previously RLS on `reactions` was own-rows-only, so `listAllReactions` could not show the team.

### Intent

- Members can **SELECT** all reactions on library notes.
- Writes stay personal (`owner_id = auth.uid()`).
- UI aggregates counts across users (`mine` for pressed state).

### Implementation sketch

- Migration `009_team_reactions.sql`: member SELECT + own write policies; Realtime publish `reactions`.
- `aggregateReactionRows` → one entry per (note, emoji) with team `count` + `mine`.
- `ReactionBar` uses `mine` for pressed; count shows the team total.
- Live meta sync refreshes reactions so ✅ appears for others without reload.

### Done when

- [x] Product decision recorded (team-visible vs personal-only)
- [x] If team-visible: RLS + list/aggregate + UI counts match across two accounts
- [x] Cart remains personal either way

---

## Phase 5 — Incremental sync / scale hygiene

**Status:** Not started

**Why last:** Speed under many concurrent users and larger libraries. Builds on Phase 3.

### Intent

- Incremental fetch: `WHERE updated_at > :cursor` (or rely on Realtime after first load).
- Avoid re-signing every image on refresh (keep `signedUrlCache` / wall-thumb path).
- Coalesce Realtime bursts; prioritize visible notes.
- ~~Optional UX: show **author** on cards~~ → **done** (see Collaboration UX table).
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
| 2026-10-24 | — | Gameplan created (baseline documented; no code changes) | merged to main |
| 2026-10-24 | 1 | Soft edit locks (`note_edit_locks` + editor banner / Take over) | PR #85 |
| 2026-10-24 | 2 | Versioned `updateNote` + Save conflict dialog (Reload / Keep mine) | merged to main |
| 2026-10-24 | 3 | Live wall sync (Realtime + focus cursor + remote-change banner) | merged to main |
| 2026-10-24 | 4 | Team-visible reactions (RLS + aggregate); UI gated off via `SHOW_REACTIONS` | merged to main |
| 2026-10-24 | UX | Author labels on wall cards (`SHOW_NOTE_AUTHOR` + `010_library_member_labels`) | merged to main |
| 2026-10-24 | UX | Remote-change wall pulse (`SHOW_REMOTE_WALL_PULSE`) | merged to main |
| 2026-10-24 | UX | Online presence strip (`SHOW_ONLINE_PRESENCE` + Realtime Presence) | (this branch) |

<!--
Example row after a phase ships:
| 2026-11-02 | 1 | Soft locks via note_edit_locks + editor banner | #123 / abcdef0 |
-->
