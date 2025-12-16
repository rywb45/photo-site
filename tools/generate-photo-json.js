import fs from "fs";
import path from "path";

const root = process.cwd();
const photosDir = path.join(root, "photos");
const outFile = path.join(root, "photos.json");

const allowed = new Set([".jpg", ".jpeg"]);

function isAllowed(file) {
  const ext = path.extname(file).toLowerCase();
  if (!allowed.has(ext)) return false;
  if (/^signature\./i.test(file)) return false;
  return true;
}

if (!fs.existsSync(photosDir)) {
  console.error(`Missing /photos folder at: ${photosDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(photosDir)
  .filter(isAllowed)
  .sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

fs.writeFileSync(outFile, JSON.stringify(files, null, 2) + "\n", "utf8");
console.log(`Wrote ${files.length} entries to photos.json`);
