import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildLoreMigrationPlan } from "../src/shared/maintenance/loreMigration.js";

const require = createRequire(import.meta.url);
const { initializeApp } = require("firebase/app");
const {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  setDoc,
  terminate,
  writeBatch,
} = require("firebase/firestore");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
let activeFirestore = null;

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnv();
  let sourceArticles = [];
  let activePcActorIds = [];
  let firestore = null;

  if (args.fromFirestore || args.write) {
    firestore = createFirestore();
    const [articleSnapshot, actorSnapshot] = await Promise.all([
      getDocs(collection(firestore, "loreArticles")),
      getDocs(collection(firestore, "campaigns", args.campaignId, "actors")),
    ]);
    sourceArticles = articleSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    activePcActorIds = actorSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .filter((actor) => actor.kind === "pc" && !actor.deletedAt)
      .map((actor) => actor.id);
  } else {
    const payload = JSON.parse(fs.readFileSync(path.resolve(repoRoot, args.input), "utf8"));
    sourceArticles = extractArticles(payload);
    activePcActorIds = args.actorIds;
  }

  const plan = buildLoreMigrationPlan({
    campaignId: args.campaignId,
    legacyArticles: sourceArticles,
    activePcActorIds,
    actor: "lore-migration",
  });
  const reportPath = writeJson(args.reportOut, { mode: args.write ? "write" : "dry-run", ...plan.report });
  if (args.docsOut) writeJson(args.docsOut, {
    articles: plan.articles,
    groups: plan.groups,
    deliveries: plan.deliveries,
  });

  if (args.write) {
    if (!args.confirmWrite) throw new Error("Write mode requires --confirm-write. Top-level source documents will still be retained.");
    await writeLoreMigration(firestore, plan);
  }

  console.log(JSON.stringify({
    mode: args.write ? "write" : "dry-run",
    reportPath,
    ...plan.report.counts,
  }, null, 2));
}

function parseArgs(argv) {
  const args = {
    campaignId: null,
    input: "recovery/recovered-lore-pacts-deviant-2026-07-06.json",
    reportOut: "recovery/lore-campaign-migration-report.json",
    docsOut: null,
    fromFirestore: false,
    write: false,
    confirmWrite: false,
    actorIds: [],
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--campaign") args.campaignId = argv[++index];
    else if (arg === "--input") args.input = argv[++index];
    else if (arg === "--report-out") args.reportOut = argv[++index];
    else if (arg === "--docs-out") args.docsOut = argv[++index];
    else if (arg === "--actor") args.actorIds.push(argv[++index]);
    else if (arg === "--from-firestore") args.fromFirestore = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--confirm-write") args.confirmWrite = true;
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.campaignId) throw new Error("Use --campaign <campaignId>.");
  if (args.write && !args.fromFirestore) throw new Error("Write mode requires --from-firestore.");
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/migrate_lore_to_campaign.js --campaign <id> [--input recovery/file.json] [--actor actorId]
  node scripts/migrate_lore_to_campaign.js --campaign <id> --from-firestore
  node scripts/migrate_lore_to_campaign.js --campaign <id> --from-firestore --write --confirm-write

Dry-run is the default. Write mode creates a migrationBackups document and retains all top-level loreArticles.
`);
}

async function writeLoreMigration(firestore, plan) {
  const backupId = `lore-campaign-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await setDoc(doc(firestore, "migrationBackups", backupId), {
    id: backupId,
    type: "lore-campaign-migration",
    campaignId: plan.campaignId,
    createdAt: new Date().toISOString(),
    sourceRetained: true,
    sourceArticles: plan.backup.articles,
    report: plan.report,
  });
  const operations = [
    ...plan.articles.map((data) => ({ collectionName: "loreArticles", data })),
    ...plan.groups.map((data) => ({ collectionName: "loreGroups", data })),
    ...plan.deliveries.map((data) => ({ collectionName: "loreDeliveries", data })),
  ];
  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(firestore);
    operations.slice(start, start + 450).forEach(({ collectionName, data }) => {
      batch.set(doc(firestore, "campaigns", plan.campaignId, collectionName, data.id), data);
    });
    await batch.commit();
  }
}

function extractArticles(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.loreArticleDocuments)) {
    return payload.loreArticleDocuments.map((entry) => ({
      id: entry.data?.id || String(entry.path || "").split("/").at(-1),
      ...(entry.data || {}),
    }));
  }
  if (Array.isArray(payload.loreArticles)) return payload.loreArticles;
  if (Array.isArray(payload.lore?.articles)) return payload.lore.articles;
  throw new Error("Input contains no recognized Lore article array.");
}

function loadDotEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = path.join(repoRoot, fileName);
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      const separator = trimmed.indexOf("=");
      if (!trimmed || trimmed.startsWith("#") || separator < 0) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (process.env[key] == null) process.env[key] = value;
    });
  }
}

function createFirestore() {
  const config = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId) throw new Error("Missing Firebase configuration.");
  activeFirestore = initializeFirestore(initializeApp(config), { experimentalForceLongPolling: true });
  return activeFirestore;
}

function writeJson(relativePath, data) {
  const target = path.resolve(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf8");
  return target;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeFirestore) await terminate(activeFirestore).catch(() => {});
  });
