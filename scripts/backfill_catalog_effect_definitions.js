import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildCatalogEffectBackfillPlan } from "../src/shared/maintenance/catalogEffectBackfill.js";

const require = createRequire(import.meta.url);
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { collection, doc, getDocs, initializeFirestore, setDoc, terminate, writeBatch } = require("firebase/firestore");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
let activeFirestore = null;

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnv();
  const app = initializeApp(readFirebaseConfig());
  activeFirestore = initializeFirestore(app, { experimentalForceLongPolling: true });
  await authenticate(app);
  const snapshot = await getDocs(collection(activeFirestore, "catalogOverrides"));
  const existingOverrides = snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() }));
  const plan = buildCatalogEffectBackfillPlan({
    catalogIndexes: loadCatalogIndexes(),
    existingOverrides,
  });
  const report = {
    mode: args.write ? "write" : "dry-run",
    createdAt: new Date().toISOString(),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    counts: plan.counts,
    writes: plan.writes.map(entry => ({
      id: entry.override.id,
      catalogType: entry.catalogType,
      name: entry.source.name,
      operation: entry.before ? "update" : "create",
      definitionIds: entry.override.payload.rules.effectDefinitions.map(definition => definition.id),
    })),
    skipped: plan.skipped,
  };
  if (args.write) {
    if (!args.confirmWrite) throw new Error("Write mode requires --confirm-write.");
    report.backupId = await writePlan(activeFirestore, plan, report);
  }
  report.reportPath = writeJson(args.reportOut, report);
  console.log(JSON.stringify(report, null, 2));
}

function loadCatalogIndexes() {
  return {
    item: decodeCompactIndex("src/data/shop_index.json", 9),
    feat: decodeCompactIndex("src/data/feat_index.json", 6),
    spell: decodeCompactIndex("src/data/spell_index.json", 7),
    impulse: decodeCompactIndex("src/data/impulse_index.json", 7),
  };
}

function decodeCompactIndex(relativePath, levelIndex) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8"));
  return (payload.items || []).map(row => ({
    name: row?.[0] || "",
    sourceFile: row?.[2] || null,
    level: typeof row?.[levelIndex] === "number" ? row[levelIndex] : 0,
  })).filter(entry => entry.name && entry.sourceFile);
}

async function writePlan(firestore, plan, report) {
  if (!plan.writes.length) return null;
  const backupId = `catalog-effects-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await setDoc(doc(firestore, "migrationBackups", backupId), {
    id: backupId,
    type: "catalog-effect-definitions",
    createdAt: report.createdAt,
    projectId: report.projectId,
    affectedOverrides: plan.writes.map(entry => ({ id: entry.override.id, before: entry.before })),
    report,
  });
  for (let start = 0; start < plan.writes.length; start += 450) {
    const batch = writeBatch(firestore);
    plan.writes.slice(start, start + 450).forEach(entry => {
      batch.set(doc(firestore, "catalogOverrides", entry.override.id), {
        ...entry.override,
        updatedAt: report.createdAt,
        updatedBy: process.env.FIREBASE_MIGRATION_EMAIL,
        schemaVersion: 5,
      }, { merge: true });
    });
    await batch.commit();
  }
  return backupId;
}

async function authenticate(app) {
  const email = process.env.FIREBASE_MIGRATION_EMAIL;
  const password = process.env.FIREBASE_MIGRATION_PASSWORD;
  if (!email || !password) {
    throw new Error("Set FIREBASE_MIGRATION_EMAIL and FIREBASE_MIGRATION_PASSWORD for the read-only dry-run identity.");
  }
  await signInWithEmailAndPassword(getAuth(app), email, password);
}

function parseArgs(argv) {
  const args = { write: false, confirmWrite: false, reportOut: "recovery/catalog-effects-backfill-report.json" };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--confirm-write") args.confirmWrite = true;
    else if (arg === "--report-out") args.reportOut = argv[++index];
    else if (arg === "--help") {
      console.log("Usage: node scripts/backfill_catalog_effect_definitions.js [--report-out file] [--write --confirm-write]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function loadDotEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = path.join(repoRoot, fileName);
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      const separator = trimmed.indexOf("=");
      if (!trimmed || trimmed.startsWith("#") || separator < 0) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (process.env[key] == null) process.env[key] = value;
    });
  }
}

function readFirebaseConfig() {
  const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId) throw new Error("Missing Firebase configuration.");
  return config;
}

function writeJson(relativePath, payload) {
  const target = path.resolve(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2), "utf8");
  return target;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (activeFirestore) await terminate(activeFirestore).catch(() => {});
});
