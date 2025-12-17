import fs from "fs";
import path from "path";

const root = process.cwd();
const photosDir = path.join(root, "photos");
const outFile = path.join(root, "photos.json");
const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isAllowed(file) {
  const ext = path.extname(file).toLowerCase();
  return allowed.has(ext) && !/^signature\./i.test(file);
}

if (!fs.existsSync(photosDir)) {
  console.error(`Missing /photos folder at: ${photosDir}`);
  process.exit(1);
}

const albums = {};

// Read all items in photos directory
const items = fs.readdirSync(photosDir, { withFileTypes: true });

// Sort folders naturally (handles number prefixes)
const folders = items
  .filter(item => item.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

for (const item of folders) {
  const folderName = item.name;
  const albumPath = path.join(photosDir, folderName);
  
  // Strip number prefix (e.g., "01-nyc" becomes "nyc")
  const displayName = folderName.replace(/^\d+-/, '');
  
  const albumFiles = fs
    .readdirSync(albumPath)
    .filter(isAllowed)
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    )
    .map(f => `${folderName}/${f}`); // Use actual folder name in path
  
  if (albumFiles.length > 0) {
    albums[displayName] = albumFiles;
  }
}

// Check if any albums were found
if (Object.keys(albums).length === 0) {
  console.error("No album folders found in /photos. Create folders like /photos/01-nyc/ and /photos/02-archive/");
  process.exit(1);
}

fs.writeFileSync(outFile, JSON.stringify(albums, null, 2) + "\n", "utf8");

console.log(`Generated photos.json with ${Object.keys(albums).length} albums:`);
for (const [album, files] of Object.entries(albums)) {
  console.log(`  - ${album}: ${files.length} photos`);
}
