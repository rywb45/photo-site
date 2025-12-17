import fs from "fs";
import path from "path";

const root = process.cwd();
const src = path.join(root, "src");
const photos = path.join(root, "photos");
const dist = path.join(root, "dist");
const distPhotos = path.join(dist, "photos");
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(distPhotos, { recursive: true });

for (const f of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, f), path.join(dist, f));
}

const sigCandidates = ["signature.png", "signature.jpg", "signature.jpeg", "signature.webp"];
for (const s of sigCandidates) {
  const sigPath = path.join(photos, s);
  if (fs.existsSync(sigPath)) {
    fs.copyFileSync(sigPath, path.join(distPhotos, s));
    break;
  }
}

let files = fs.readdirSync(photos)
  .filter(f => exts.has(path.extname(f).toLowerCase()))
  .filter(f => !/^signature\./i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

for (const f of files) {
  fs.copyFileSync(path.join(photos, f), path.join(distPhotos, f));
}

// FIX: Add "photos/" prefix to each filename
const filesWithPath = files.map(f => `photos/${f}`);

fs.writeFileSync(path.join(dist, "photos.json"), JSON.stringify(filesWithPath, null, 2));
