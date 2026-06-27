import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

const protectedFiles = new Set([
  "src/admin/AdminApp.jsx",
  "src/admin/ItemsView.jsx",
  "src/admin/EncounterView.jsx",
  "src/admin/QuestsView.jsx",
  "src/admin/MapAdminView.jsx",
  "src/admin/ProgressAdminView.jsx",
  "src/admin/AbilitiesView.jsx",
  "src/admin/BestiaryView.jsx",
  "src/admin/LoreAdminView.jsx",
  "src/pacts/DeviantAbilitiesAdminView.jsx",
  "src/pacts/PactAdminView.jsx",
  "src/player/PlayerAppController.jsx",
  "src/player/views/InventoryView.jsx",
  "src/player/views/ProgressView.jsx",
  "src/player/views/PlayerQuestsView.jsx",
  "src/player/views/MapsView.jsx",
  "src/camping/CampingAdminView.jsx",
  "src/camping/CampingView.jsx",
  "src/camping/CampScreen.jsx",
  "src/shared/context/CampaignContext.jsx",
]);

const allowedBroadWriteFiles = new Map([
  ["src/shared/db/domain/createDataActions.js", "legacy adapter implementation"],
]);

const broadWritePatterns = [
  { name: "setDb", regex: /\bsetDb\s*\(/g },
  { name: "updateActiveCampaign", regex: /\bupdateActiveCampaign\s*\(/g },
];

const legacyDiffAllowedFiles = new Set([
  "src/shared/db/v2/firestoreMigration.js",
]);

const forbiddenRuntimeContracts = [
  {
    name: "character.conditions",
    pattern: "character.conditions",
    allowedFiles: new Set(["src/shared/db/v2/normalizers.js"]),
  },
  {
    name: "character.companion",
    pattern: "character.companion",
    allowedFiles: new Set(["src/shared/db/v2/normalizers.js"]),
  },
  {
    name: "db.characters",
    pattern: "db.characters",
    allowedFiles: new Set([
      "src/shared/db/v2/normalizers.js",
      "src/admin/views/SessionManager.jsx",
    ]),
  },
  {
    name: "repos.characterRepo",
    pattern: "repos.characterRepo",
    allowedFiles: new Set([]),
  },
  {
    name: "character.currentMutagen",
    pattern: "currentMutagen",
    allowedFiles: new Set([]),
  },
];

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
    failures.push(`${rel}: writeLegacyDbDiffToV2 is only allowed in legacy import/migration code`);
  }

  for (const contract of forbiddenRuntimeContracts) {
    if (text.includes(contract.pattern) && !contract.allowedFiles.has(rel)) {
      failures.push(`${rel}: ${contract.name} is isolated to migration/import/projection code`);
    }
  }

  if (text.includes("/api/files/save") && !text.includes("import.meta.env.PROD")) {
    failures.push(`${rel}: /api/files/save must be guarded by a production-safe DB override path`);
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
