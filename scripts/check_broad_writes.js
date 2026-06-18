import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

const protectedFiles = new Set([
  "src/admin/ItemsView.jsx",
  "src/admin/EncounterView.jsx",
  "src/admin/QuestsView.jsx",
  "src/admin/MapAdminView.jsx",
  "src/admin/ProgressAdminView.jsx",
  "src/player/views/InventoryView.jsx",
  "src/player/views/ProgressView.jsx",
  "src/player/views/PlayerQuestsView.jsx",
  "src/player/views/MapsView.jsx",
  "src/camping/CampingAdminView.jsx",
  "src/camping/CampingView.jsx",
  "src/camping/CampScreen.jsx",
]);

const allowedBroadWriteFiles = new Map([
  ["src/admin/AbilitiesView.jsx", "legacy global abilities"],
  ["src/admin/AdminApp.jsx", "legacy admin/player tab glue"],
  ["src/admin/BestiaryView.jsx", "legacy bestiary catalog"],
  ["src/admin/LoreAdminView.jsx", "legacy lore catalog"],
  ["src/pacts/DeviantAbilitiesAdminView.jsx", "legacy deviant abilities"],
  ["src/pacts/PactAdminView.jsx", "legacy pacts"],
  ["src/player/PlayerAppController.jsx", "legacy notification and runtime repair fallback"],
  ["src/shared/context/CampaignContext.jsx", "deprecated compatibility escape hatch"],
  ["src/shared/db/domain/createDataActions.js", "legacy adapter implementation"],
]);

const broadWritePatterns = [
  { name: "setDb", regex: /\bsetDb\s*\(/g },
  { name: "updateActiveCampaign", regex: /\bupdateActiveCampaign\s*\(/g },
];

const legacyDiffAllowedFiles = new Set([
  "src/shared/db/v2/firestoreMigration.js",
  "src/shared/db/v2/useFirestoreV2Db.js",
]);

const failures = [];
const seenBroadWriteFiles = new Set();

for (const file of listSourceFiles(srcRoot)) {
  const rel = toRepoPath(file);
  const text = fs.readFileSync(file, "utf8");

  for (const pattern of broadWritePatterns) {
    pattern.regex.lastIndex = 0;
    const matches = [...text.matchAll(pattern.regex)];
    if (matches.length === 0) continue;
    seenBroadWriteFiles.add(rel);
    if (protectedFiles.has(rel)) {
      failures.push(`${rel}: migrated domain contains ${pattern.name}`);
    } else if (!allowedBroadWriteFiles.has(rel)) {
      failures.push(`${rel}: broad write is not listed in docs/agent/migration-backlog.md`);
    }
  }

  if (text.includes("writeLegacyDbDiffToV2") && !legacyDiffAllowedFiles.has(rel)) {
    failures.push(`${rel}: writeLegacyDbDiffToV2 is only allowed in the V2 compatibility layer`);
  }
}

for (const rel of allowedBroadWriteFiles.keys()) {
  if (!seenBroadWriteFiles.has(rel) && !fs.existsSync(path.join(repoRoot, rel))) {
    failures.push(`${rel}: allow-list entry points to a missing file`);
  }
}

if (failures.length > 0) {
  console.error("Broad write guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Broad write guard passed (${seenBroadWriteFiles.size} broad-write files tracked).`);

function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(js|jsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function toRepoPath(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}
