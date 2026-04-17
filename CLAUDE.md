# Photo Site

Personal photo gallery at **ryanbyrne.me**. Static site — no build step, no framework, no test suite. Deployed directly from `main` via GitHub Pages (CNAME → `ryanbyrne.me`).

Owner repo: `rywb45/photo-site` (hardcoded in `script.js` for the GitHub API calls used by edit mode).

## Files

- `index.html` — shell: sidebar, grid, lightbox, mobile header. Includes `<base href="/">` so relative asset paths resolve from root regardless of current URL path
- `404.html` — **duplicate of `index.html`**. GitHub Pages serves it for any unmatched path, which is how `/blizzard`-style URLs work (see Routing below). Keep the two files in sync when editing the shell
- `script.js` (~3500 lines) — all JS, no modules, no bundler
- `styles.css` (~1100 lines) — all CSS
- `photos.json` — **source of truth for album contents**. Object keyed by album name. Each entry: `{ src, grid, w, h }` pointing into `photos/`
- `photos/` — image assets. Each album folder has a `grid/` subfolder with thumbnails (`src` = full, `grid` = thumb)
- `order.json`, `moves.json` — edit-mode bookkeeping artifacts; not consumed by the runtime
- `tools/generate-photo-json.js` — legacy folder-scanning generator (run via `npm run gen`). Not the primary source of truth anymore — `photos.json` is maintained through edit mode
- `.github/workflows/generate-photos.yml` — runs the generator on pushes that touch `tools/` or `package.json`

## Routing — shareable album URLs

Every album has a unique path: `ryanbyrne.me/blizzard`, `ryanbyrne.me/chinatown`, etc. Hidden albums work the same way (useful for sharing without exposing in nav).

How it works on a static host (GitHub Pages):
- **Direct loads** (`ryanbyrne.me/blizzard`): GitHub Pages returns `404.html` for the unknown path. Because `404.html` is a copy of `index.html`, the SPA boots. `albumFromPath()` in `script.js` reads `location.pathname` and calls `switchAlbum()`. HTTP status is technically 404, which is fine for a personal site (no SEO impact worth caring about).
- **Client-side nav**: `switchAlbum()` calls `updateUrlForAlbum()` which uses `history.pushState` to update the URL without reload. `popstate` listener handles back/forward.
- **URL normalization**: first call after load uses `replaceState` (not `pushState`) so junk paths like `/Blizzard` or `/typo` get cleaned to canonical `/blizzard` (or `/`) without adding history entries. The `urlInitialized` flag tracks this.
- **`<base href="/">`** is load-bearing — without it, `fetch('photos.json')` from `/blizzard` would try `/blizzard/photos.json`. All relative URLs (fetch, img.src, link rel, script src) resolve against the base.

When editing the shell HTML, **update both `index.html` and `404.html`**.

## `photos.json` special keys

- `_unsorted` — array of photos not yet assigned to an album (shown in edit-mode tray)
- `_hidden` — array of album-name strings to hide from public nav (still reachable when known)
- Everything else is a user-visible album

When iterating user albums, filter these out (see `albumKeys()` at `script.js:19`).

## Edit mode

Hidden, client-only. Double-clicking the name in the sidebar opens a GitHub PAT login modal. The token is persisted in `localStorage` (`gh_token`) and used to call the GitHub Contents API directly to commit photo uploads, reorders, renames, and `photos.json` updates. There is no server.

The token must have `contents:write` scope on the repo. All writes commit straight to `main`.

## Lightbox carousel — virtual 3-slide

Only three DOM slides exist (prev / current / next); content swaps via `updateVirtualSlides()`. The center slot is always the current image.

Gotchas to respect when touching `script.js`:
- Any `lbTrack.style.transform` in wheel/touch handlers uses `-1 * window.innerWidth` (the center slot offset), **not** `-currentIndex * window.innerWidth`. Getting this wrong breaks swipe.
- `updateVirtualSlides()` must run after `currentIndex` changes but before anything reads slide DOM.
- `goToSlide()` animates to slot 0 or 2, then `completeSnap()` snaps back to center after 310ms. The `isSnapping` flag guards against fast-swipe conflicts during that window.
- On mobile, the counter (`#lb-counter`) replaces dots inside `.lb-dots`.

## Edit-mode drag

`renderEditGrid()` calls `refreshDragCaches()` at its start to reset cached DOM refs (`cachedNavLinks`, `cachedUnsortedBtn`, `cachedUnsortedTray`). If you add new drag targets, extend the cache there. Drag uses viewport culling and squared-distance comparisons for perf.

## Conventions

- Album names are sanitized with `sanitizeAlbumKey()` (lowercase, `a-z0-9-` only, reserved names rejected)
- Upload validation checks type/size/dimensions **before** the upload loop, not per-file
- No TypeScript, no linter config — match the existing style (2-space indent, single quotes, semicolons)

## Testing

No automated tests. Verify changes by opening `index.html` locally (any static server) and exercising the golden path + edit mode. Mention explicitly when UI changes haven't been browser-tested.
