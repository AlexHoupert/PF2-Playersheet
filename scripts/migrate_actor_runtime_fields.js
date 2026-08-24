import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { buildActorRuntimeBackfillPlan } from "../src/shared/maintenance/actorRuntimeBackfill.js";

const require = createRequire(import.meta.url);
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const {
  collection,
  doc,
  getDoc,
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
  const app = initializeApp(readFirebaseConfig());
  activeFirestore = initializeFirestore(app, { experimentalForceLongPolling: true });
  await authenticate(app);

  const actorRecords = await readActorRecords(activeFirestore);
  const recoveryByActorId = await readSpellRecovery(activeFirestore, args.recoveryBackupId);
  const plan = buildActorRuntimeBackfillPlan(actorRecords, { recoveryByActorId });
  const createdAt = new Date().toISOString();
  const report = {
    mode: args.write ? "write" : "dry-run",
    createdAt,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    recoveryBackupId: args.recoveryBackupId || null,
    counts: plan.counts,
    writes: plan.writes.map((entry) => ({
      campaignId: entry.campaignId,
      actorId: entry.actorId,
      actorName: entry.before.name || entry.before.sheet?.name || null,
      conflicts: entry.conflicts,
      removedMirrorFields: entry.removedMirrorFields,
      recoveredSpellCount: entry.recoveredSpellCount,
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

async function readActorRecords(firestore) {
  const campaigns = await getDocs(collection(firestore, "campaigns"));
  const records = [];
  for (const campaignSnapshot of campaigns.docs) {
    const actors = await getDocs(collection(firestore, "campaigns", campaignSnapshot.id, "actors"));
    actors.docs.forEach((actorSnapshot) => {
      records.push({
        campaignId: campaignSnapshot.id,
        actorId: actorSnapshot.id,
        actor: { id: actorSnapshot.id, ...actorSnapshot.data() },
      });
    });
  }
  return records;
}

async function readSpellRecovery(firestore, backupId) {
  if (!backupId) return {};
  const snapshot = await getDoc(doc(firestore, "migrationBackups", backupId));
  if (!snapshot.exists()) throw new Error(`Recovery backup not found: ${backupId}`);
  const backup = snapshot.data();
  if (!backup.actorId || !Array.isArray(backup.afterSpellList)) {
    throw new Error(`Recovery backup ${backupId} has no actorId/afterSpellList.`);
  }
  return {
    [backup.actorId]: {
      campaignId: backup.campaignId || null,
      spellList: backup.afterSpellList,
    },
  };
}

async function writePlan(firestore, plan, report) {
  if (!plan.writes.length) return null;
  const backupId = `actor-runtime-${report.createdAt.replace(/[:.]/g, "-")}`;
  const backupRef = doc(firestore, "migrationBackups", backupId);
  await setDoc(backupRef, {
    id: backupId,
    type: "actor-runtime-field-canonicalization",
    createdAt: report.createdAt,
    createdBy: process.env.FIREBASE_MIGRATION_EMAIL,
    projectId: report.projectId,
    affectedActorCount: plan.writes.length,
    recoveryBackupId: report.recoveryBackupId,
    report,
  });

  for (let start = 0; start < plan.writes.length; start += 400) {
    const batch = writeBatch(firestore);
    plan.writes.slice(start, start + 400).forEach((entry) => {
      const backupActorId = `${entry.campaignId}__${entry.actorId}`.replaceAll("/", "_");
      batch.set(doc(firestore, "migrationBackups", backupId, "actors", backupActorId), {
        campaignId: entry.campaignId,
        actorId: entry.actorId,
        before: entry.before,
      });
    });
    await batch.commit();
  }

  for (let start = 0; start < plan.writes.length; start += 400) {
    const batch = writeBatch(firestore);
    plan.writes.slice(start, start + 400).forEach((entry) => {
      batch.set(doc(firestore, "campaigns", entry.campaignId, "actors", entry.actorId), {
        ...entry.after,
        schemaVersion: 3,
        updatedAt: report.createdAt,
        updatedBy: process.env.FIREBASE_MIGRATION_EMAIL,
        lastMutation: {
          type: "actor_runtime_canonicalization",
          backupId,
          at: report.createdAt,
          by: process.env.FIREBASE_MIGRATION_EMAIL,
        },
      });
    });
    await batch.commit();
  }
  return backupId;
}

async function authenticate(app) {
  const email = process.env.FIREBASE_MIGRATION_EMAIL;
  const password = process.env.FIREBASE_MIGRATION_PASSWORD;
  if (!email || !password) {
    throw new Error("Set FIREBASE_MIGRATION_EMAIL and FIREBASE_MIGRATION_PASSWORD.");
  }
  await signInWithEmailAndPassword(getAuth(app), email, password);
}

function parseArgs(argv) {
  const args = {
    write: false,
    confirmWrite: false,
    recoveryBackupId: null,
    reportOut: "recovery/actor-runtime-backfill-report.json",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--confirm-write") args.confirmWrite = true;
    else if (arg === "--recovery-backup-id") args.recoveryBackupId = argv[++index];
    else if (arg === "--report-out") args.reportOut = argv[++index];
    else if (arg === "--help") {
      console.log("Usage: node scripts/migrate_actor_runtime_fields.js [--recovery-backup-id id] [--report-out file] [--write --confirm-write]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (activeFirestore) await terminate(activeFirestore).catch(() => {});
});
