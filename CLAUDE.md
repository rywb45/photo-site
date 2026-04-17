# Photo Site

Personal photo gallery at **ryanbyrne.me**. Static site — no build step, no framework, no test suite. Deployed directly from `main` via GitHub Pages (CNAME → `ryanbyrne.me`).

Owner repo: `rywb45/photo-site` (hardcoded in `script.js` for the GitHub API calls used by edit mode).

## Files

- `index.html` — shell: sidebar, grid, lightbox, mobile header. Includes `<base href="/">` so relative asset paths resolve from root regardless of current URL path
- `404.html` — **duplicate of `index.html`**. GitHub Pages serves it for any unmatched path. It's the fallback when no per-album page exists. Keep it in sync with `index.html` when editing the shell
- `<album>/index.html` — **auto-generated** per-album pages (e.g. `blizzard/index.html`) with Open Graph / Twitter meta tags so shared URLs show a preview card with the album's first photo. Identical to `index.html` except for the injected meta tags and per-album `<title>`. Each directory has a `.album-page` sentinel so the generator knows which dirs it owns. **Do not hand-edit** — regenerate via `npm run gen:albums`
- `favicon.ico` — real ICO file (converted from `favicon.png`). Required because browsers auto-request `/favicon.ico`, and without this file GH Pages would serve the SPA `404.html` as the response, which browsers interpret as "no favicon"
- `script.js` (~3500 lines) — all JS, no modules, no bundler
- `styles.css` (~1100 lines) — all CSS
- `photos.json` — **source of truth for album contents**. Object keyed by album name. Each entry: `{ src, grid, w, h }` pointing into `photos/`
- `photos/` — image assets. Each album folder has a `grid/` subfolder with thumbnails (`src` = full, `grid` = thumb)
- `order.json`, `moves.json` — edit-mode bookkeeping artifacts; not consumed by the runtime
- `tools/generate-photo-json.js` — **legacy**. Scans `photos/` and writes a flat `photos.json`. Running it would destroy the rich `photos.json` edit mode maintains (no `grid`/`w`/`h`/`_hidden`/ordering). Only run via the workflow's manual `regen_photos_json` input
- `tools/generate-album-pages.js` — writes the per-album HTML files. Reads `photos.json`, templates off `index.html`, cleans up stale directories via the `.album-page` sentinel. Invoke with `npm run gen:albums`
- `.github/workflows/generate-photos.yml` — on any push touching `photos.json`, `index.html`, or the generator itself, runs `npm run gen:albums` and auto-commits the resulting album pages. The legacy `npm run gen` step is gated behind a manual `workflow_dispatch` input

## Routing — shareable album URLs

Every album has a unique path: `ryanbyrne.me/blizzard`, `ryanbyrne.me/chinatown`, etc. Hidden albums work the same way (useful for sharing without exposing in nav).

How it works on a static host (GitHub Pages):
- **Direct loads of a known album** (`ryanbyrne.me/blizzard/`): GH Pages serves `/blizzard/index.html` (generated) — 200 status, with OG meta tags so shared URLs get a preview card. GH Pages 301-redirects `/blizzard` → `/blizzard/`, so `pushState` writes URLs *with* the trailing slash to avoid a reload-time redirect.
- **Direct loads of an unknown path**: GH Pages returns `404.html` (a duplicate of `index.html`). The SPA boots, `albumFromPath()` reads `location.pathname`, and if it matches nothing the user sees the default album.
- **Client-side nav**: `switchAlbum()` → `updateUrlForAlbum()` uses `pushState` to update the URL without reload. `popstate` handles back/forward.
- **URL normalization**: first call after load uses `replaceState` (not `pushState`) so junk paths like `/Blizzard/` or `/typo` get cleaned to canonical `/blizzard/` without adding history entries. The `urlInitialized` flag tracks this.
- **`<base href="/">`** is load-bearing — without it, `fetch('photos.json')` from `/blizzard/` would try `/blizzard/photos.json`. All relative URLs (fetch, img.src, link rel, script src) resolve against the base.

When editing the shell HTML, **update `index.html` then run `npm run gen:albums`** — the generator templates off `index.html` and rewrites every `<album>/index.html`. Also keep `404.html` in sync manually.

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

- Album names are stored as slugs — sanitized with `sanitizeAlbumKey()` (lowercase, `a-z0-9-` only, reserved names rejected). Display names (nav, mobile header, generated `<title>`) convert `-` back to space via `displayAlbumName()` — so the slug `lincoln-square` shows as `LINCOLN SQUARE`. Storage/URL slug and display name are decoupled on purpose
- Upload validation checks type/size/dimensions **before** the upload loop, not per-file
- No TypeScript, no linter config — match the existing style (2-space indent, single quotes, semicolons)

## Testing

No automated tests. Verify changes by opening `index.html` locally (any static server) and exercising the golden path + edit mode. Mention explicitly when UI changes haven't been browser-tested.

## Workflow

**Always commit and push changes to `main` without asking.** The site deploys directly from `main` via GitHub Pages — the user tests on the live URL, so local-only edits are useless to them. After making changes: `git add` the relevant files (not `.DS_Store` or unrelated modifications), commit, and `git push`. If the push is rejected as non-fast-forward, stash unrelated unstaged changes, `git pull --rebase origin main`, push, then restore the stash.
