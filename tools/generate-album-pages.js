// Generate per-album static HTML pages at /<album>/index.html so that
// shared URLs like https://ryanbyrne.me/blizzard/ have proper Open Graph /
// Twitter preview cards. Social media scrapers don't run JS, so the meta tags
// must be in the server-delivered HTML — which is why this exists.
//
// Each generated file is a duplicate of index.html with an injected block of
// og:* / twitter:* meta tags and a per-album <title>. The SPA still boots and
// reads `location.pathname` to show the right album, so client behavior is
// unchanged from the user's perspective.
//
// Stale album directories (ones whose slug is no longer in photos.json) are
// removed. Detection is via a sentinel file `.album-page` placed in each
// generated directory so we never touch unrelated folders.
//
// Runs in CI (see .github/workflows/generate-photos.yml) and can be invoked
// locally via `npm run gen:albums`.

import fs from "fs";
import path from "path";

const root = process.cwd();
const SITE_URL = "https://ryanbyrne.me";
const SENTINEL = ".album-page";

const albums = JSON.parse(fs.readFileSync(path.join(root, "photos.json"), "utf8"));
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

function displayName(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function metaTagsForAlbum(slug, photos) {
  const first = photos[0];
  if (!first || !first.src) return null;
  const title = `Ryan Byrne — ${displayName(slug)}`;
  const imageUrl = `${SITE_URL}/photos/${first.src}`;
  const pageUrl = `${SITE_URL}/${encodeURIComponent(slug)}/`;
  const w = first.w || "";
  const h = first.h || "";
  return `
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Ryan Byrne">
    <meta property="og:url" content="${escapeAttr(pageUrl)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:image" content="${escapeAttr(imageUrl)}">${w && h ? `
    <meta property="og:image:width" content="${w}">
    <meta property="og:image:height" content="${h}">` : ""}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:image" content="${escapeAttr(imageUrl)}">`;
}

function buildAlbumHtml(slug, photos) {
  const tags = metaTagsForAlbum(slug, photos);
  if (!tags) return null;
  const title = `Ryan Byrne — ${displayName(slug)}`;
  // Replace the original <title>...</title> and inject OG/Twitter tags before </head>.
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`)
    .replace("</head>", `${tags}\n  </head>`);
}

const generatedSlugs = [];
for (const [slug, photos] of Object.entries(albums)) {
  if (slug.startsWith("_")) continue;
  if (!Array.isArray(photos) || photos.length === 0) continue;
  const html = buildAlbumHtml(slug, photos);
  if (!html) continue;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, SENTINEL), "");
  generatedSlugs.push(slug);
}

const currentSlugs = new Set(generatedSlugs);
let removed = 0;
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sentinelPath = path.join(root, entry.name, SENTINEL);
  if (!fs.existsSync(sentinelPath)) continue;
  if (currentSlugs.has(entry.name)) continue;
  fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
  console.log(`Removed stale album page: ${entry.name}`);
  removed++;
}

console.log(`Generated ${generatedSlugs.length} album pages${removed ? ` (removed ${removed} stale)` : ""}.`);
for (const s of generatedSlugs) console.log(`  - /${s}/`);
