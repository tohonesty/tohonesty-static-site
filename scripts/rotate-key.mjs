#!/usr/bin/env node
// rotate-key.mjs
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filtered = args.filter(a => a !== "--dry-run");
const [newKid, publicKeyPath] = filtered;

if (!newKid || !publicKeyPath) {
  console.error("Usage: node rotate-key.mjs [--dry-run] <new-kid> <path-to-new-public-key.json>");
  process.exit(1);
}

const root = process.cwd();
const newPublicKey = JSON.parse(fs.readFileSync(publicKeyPath, "utf8"));
if (newPublicKey.kid !== newKid) {
  console.error(`Key ID mismatch: file has "${newPublicKey.kid}", expected "${newKid}"`);
  process.exit(1);
}

const files = [
  "public/assets/crypto/public-key.json",
  "public/assets/js/contact.js",
  "src/protocol.js",
  "tests/site.test.mjs",
  "src/worker.js"
];

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(root, "key-rotation-backups", timestamp);

if (dryRun) {
  console.log("DRY RUN — no files will be modified or backed up\n");
} else {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Backing up files to ${path.relative(root, backupDir)}/`);
}

// Backup (or report) existing files
for (const rel of files) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.warn(`Skipping missing file: ${rel}`);
    continue;
  }
  if (dryRun) {
    console.log(`  would back up ${rel}`);
  } else {
    const dest = path.join(backupDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`  backed up ${rel}`);
  }
}

// 1. public-key.json
const destPublicKey = path.join(root, "public/assets/crypto/public-key.json");
if (dryRun) {
  console.log("Would update public/assets/crypto/public-key.json");
} else {
  fs.mkdirSync(path.dirname(destPublicKey), { recursive: true });
  fs.writeFileSync(destPublicKey, JSON.stringify(newPublicKey, null, 2) + "\n");
  console.log("Updated public/assets/crypto/public-key.json");
}

// 2–5. Replace key ID in other files
const oldKidPattern = /20\d{2}-\d{2}-r\d+/g;

for (const rel of files.slice(1)) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;

  const text = fs.readFileSync(file, "utf8");
  const updated = text.replace(oldKidPattern, newKid);

  if (updated === text) {
    console.warn(`No key ID found to replace in ${rel}`);
  } else if (dryRun) {
    console.log(`Would update ${rel}`);
  } else {
    fs.writeFileSync(file, updated);
    console.log(`Updated ${rel}`);
  }
}

if (dryRun) {
  console.log("\nDry run complete. No changes were made.");
} else {
  console.log(`\nKey rotation to ${newKid} complete.`);
  console.log(`Backups saved in: ${path.relative(root, backupDir)}/`);
  console.log("Review the changes, run the tests, then commit.");
}