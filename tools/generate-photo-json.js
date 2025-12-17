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

for (const item of items) {
  if (item.isDirectory()) {
    // It's an album folder
    const albumName = item.name;
    const albumPath = path.join(photosDir, albumName);
    
    const albumFiles = fs
      .readdirSync(albumPath)
      .filter(isAllowed)
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      )
      .map(f => `${albumName}/${f}`); // Include album name in path
    
    if (albumFiles.length > 0) {
      albums[albumName] = albumFiles;
    }
  }
}

// Check if any albums were found
if (Object.keys(albums).length === 0) {
  console.error("No album folders found in /photos. Create folders like /photos/nyc/ and /photos/archive/");
  process.exit(1);
}

fs.writeFileSync(outFile, JSON.stringify(albums, null, 2) + "\n", "utf8");

console.log(`Generated photos.json wit
