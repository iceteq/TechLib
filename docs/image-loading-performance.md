# Image loading performance — TechLib vs Google Photos

Reference for wall/photo loading speed, UX impact, and how we get closer to Google Photos.

Primary external reference: [Building the Google Photos Web UI](https://medium.com/google-design/building-the-google-photos-web-ui-45b714dfbed1) (Antin Harasymiv, Google Design).

---

## 1. What “good” feels like (Google Photos)

Photos optimized for four goals that map directly to enjoyment:

| Goal | Photos meaning | User feeling |
|---|---|---|
| **Instantaneous feel** | Something useful on screen immediately | “It’s ready” |
| **Viewport first** | Visible tiles beat off-screen work | “What I’m looking at loads” |
| **60fps scroll** | Layout/paint stay cheap while scrolling | “It doesn’t hitch” |
| **Graceful scrubbing** | Fast scroll shows cheap placeholders, not jank | “I can fly through and it catches up” |

### Photos image ladder (simplified)

1. **Empty / estimated tile** — grey box with reserved size (no layout jump).
2. **Low-res placeholder (~1KB)** — tiny, low-quality image, often prefetched **4–5 screens ahead**; scaled up (pixelated OK). Seen mainly during fast scroll.
3. **Grid thumbnail (~50–70KB HDPI)** — proper wall tile; cross-fade when replacing placeholder.
4. **Full-res** — only when opening / lightbox; thumbnail animates into place meanwhile.

### Photos network discipline

- Batch thumbnail requests (~10 at a time), not 100 at once.
- Always prioritize **visible** over off-screen.
- Prefetch in **scroll direction**; reduce work when scroll speed is high.
- Reuse a close-sized cached bitmap on resize instead of re-downloading.

### Target timings (practical SLOs for TechLib)

These are product targets inspired by Photos “instantaneous feel,” not lab measurements from Google.

| Moment | Target | Acceptable | Painful (today’s risk) |
|---|---|---|---|
| Wall chrome + note titles visible | **&lt; 300ms** after auth | &lt; 800ms | &gt; 2s blank |
| First viewport photos recognizable | **&lt; 500ms** (warm), **&lt; 1.5s** (cold) | &lt; 3s | **5–10s+** |
| Scroll into view → photo painted | **&lt; 100ms** if prefetched; else &lt; 500ms | &lt; 1s | Grey for seconds |
| Open note → full image usable | **&lt; 300ms** if wall thumb shown first; full refine &lt; 1s | &lt; 2s | White lightbox |
| Scroll FPS with 200+ cards | **~60fps** feel | Occasional hitch | Sustained jank |

Warm = same tab, signed URL session cache hit. Cold = new session / empty cache.

---

## 2. How TechLib loads images today (as of main)

### Pipeline (cloud)

```
Auth / membership
  → listNotes (notes + image metadata; URLs from session cache only)
  → paint wall (titles/cards; photo slots often empty)
  → resolveWallThumbs (batch createSignedUrls, viewport priority queue)
  → <img src=signedUrl> download bytes
  → open note → ensureFullImageUrls (full signed URL for editor)
```

### What we already got right

- Notes paint before all images finish (progressive).
- Session cache for signed URLs (reload reuse).
- Viewport / near-viewport can jump the signing queue.
- Batch `createSignedUrls` (avoided per-file transform signing that took ~10s).
- Chunked `.in(note_id)` queries for large libraries.
- Fade-in on decode; reserved `aspect-ratio` slots.

### Critical gaps vs Photos

| Photos | TechLib today | UX impact |
|---|---|---|
| Tiny **pre-made** thumbs on CDN | Wall often uses **full original** signed URL | Slow first bytes; heavy bandwidth; grey longer |
| ~1KB LQIP ahead of scroll | No placeholder ladder | Fast scroll = empty grey, not “soft preview” |
| ~70KB grid thumbs | Multi‑MB camera files on wall | Viewport floods network; enjoyment drops |
| Virtualized DOM (~tens of tiles) | **All** note cards mounted | Scroll cost grows with library size |
| Scroll-speed aware loading | No scrubbing detection | Fast scroll still queues work |
| URLs arrive with metadata | Extra **sign** RPC before any `<img>` | Extra RTT before browser can even start fetch |
| Stable CDN cache keys | New signed query tokens each session | Weaker HTTP cache across days |

### Enjoyment model

Users don’t judge “API latency”; they judge:

1. **Trust** — “Did my library disappear?” (empty wall / long white).
2. **Agency** — “Can I scan parts quickly?” (scroll + recognize).
3. **Delight** — “Does it feel instant and smooth?” (Photos-like).

Current failure modes we already hit in product:

- Long grey/white before any photo → anxiety, feels broken.
- Stale transform cache → wall “dead,” open-note still works → confusing.
- Full-res on wall → even after URL is fast, **download** still slow on mobile.

---

## 3. Root constraint: bytes × round-trips

Time to first visible photo ≈

```
T_auth + T_listNotes + T_sign(batch) + T_download(bytes) + T_decode
```

We optimized `T_listNotes` (cache-only) and `T_sign` (batch + priority).  
**`T_download` is now the main wall pain** because previews are often originals.

Photos wins because **grid bytes are small by design**, not because signing is magic.

---

## 4. Roadmap to get closer to Photos

### Phase A — Real wall derivatives (highest leverage)

**At upload**, create a small wall file (e.g. max edge ~360px, JPEG/WebP ~40–80KB) stored next to the original:

- Original: `{owner}/{noteId}/{imageId}`
- Wall: `{owner}/{noteId}/{imageId}.wall.jpg`

Wall signing/loading prefers `.wall.jpg`; falls back to original if missing (legacy photos).

**Backfill**
- **Lazy:** when the wall falls back to an original, editors quietly create `.wall.jpg` in the background (concurrency 2) and swap the card URL when ready.
- **Admin:** Sidebar → **Optimize photos** runs a full-library pass (skip existing derivatives).

**Why first:** Fixes cold viewport time and mobile data without needing transforms RPC.

**Success metric:** First-screen photos typically **&lt; 1.5s cold**, **&lt; 500ms warm**.

### Phase B — Placeholder ladder

1. Optional tiny LQIP (e.g. 32px / q20, or dominant-color) stored or generated once.
2. Prefetch LQIP ~2–4 screens ahead in scroll direction.
3. Cross-fade LQIP → wall thumb (already have opacity fade hooks).

**Success metric:** Fast scroll rarely shows empty grey; soft blobs instead.

### Phase C — Virtualization + scrubbing

- Keep ~2–3 screens of cards in the DOM (or `content-visibility` only if it doesn’t flash blank regions).
- Measure scroll velocity; pause backlog signing while scrubbing; resume on settle.
- Batch size ~8–12 in-flight image downloads (Photos-style).

**Success metric:** Smooth scroll with 500+ notes; no tab thrash.

### Phase D — URL / CDN hygiene

- Longer-lived or cookieless thumb URLs where security allows.
- Persist signed URLs carefully (we have session cache; consider IndexedDB for multi-day warm).
- Avoid minting new tokens when a cached token is still valid (already mostly true in-session).

### Phase E — Open / lightbox polish

- Open note: show wall thumb full-bleed immediately, swap to full-res (Photos click transition).
- Don’t block editor chrome on full URL.

---

## 5. Instrumentation (so we stop guessing)

Add lightweight timings (console in dev, optional analytics later):

| Event | Fields |
|---|---|
| `wall.notes_painted` | `ms` from refresh start |
| `wall.sign_batch` | `ms`, `count`, `priority\|backlog` |
| `wall.img_paint` | `ms` from `<img src>` set → `onLoad`, `bytes` if available |
| `wall.viewport_complete` | `ms` until all priority images loaded |

Dashboard question: **p50 / p90 viewport complete** on cold reload.

---

## 6. Decision log (recent)

| Change | Intent | Outcome |
|---|---|---|
| Per-file storage transforms for wall | Smaller files | Signing too slow (~10s) |
| Batch full signed URLs | Fast URL minting | URLs fast; **downloads** still heavy |
| Progressive listNotes | Paint notes first | Titles fast; photos lagged |
| Viewport sign priority | Visible first | Helps order; not bytes |
| Drop poisoned transform session cache | Fix blank wall | Restored loading |
| **Wall `.wall.jpg` derivatives** | Photos-like small tiles at upload | New uploads get ~40–80KB cards; legacy falls back to original |

---

## 7. Non-goals (for now)

- Full justified/scrubbable Photos layout (different product).
- Server-side ML sectioning.
- Perfect offline library.

---

## 8. Working principle

> **Never make the user wait on work they can’t see.  
> Never download a megabyte to fill a 260px card.**

When in doubt, match Photos: **small bytes for the grid, full bytes only on open, always viewport first.**
