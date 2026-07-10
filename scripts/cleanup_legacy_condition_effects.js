import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase/app');
const {
  collection,
  doc,
  getDocs,
  initializeFirestore,
  setDoc,
  terminate,
  writeBatch,
} = require('firebase/firestore');
import { buildLegacyConditionCleanupPlan } from '../src/shared/maintenance/legacyConditionCleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
let activeFirestore = null;

function parseArgs(argv) {
  const args = { write: false, campaignId: null, reportOut: 'recovery/legacy-condition-cleanup-report.json' };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') args.write = true;
    else if (arg === '--campaign') args.campaignId = argv[++index];
    else if (arg === '--report-out') args.reportOut = argv[++index];
    else if (arg === '--help') {
      console.log('Usage: node scripts/cleanup_legacy_condition_effects.js [--campaign campaignId] [--report-out path] [--write]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function loadDotEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const envPath = path.join(repoRoot, fileName);
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      const separator = trimmed.indexOf('=');
      if (!trimmed || trimmed.startsWith('#') || separator < 0) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
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
  if (!config.apiKey || !config.projectId) throw new Error('Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID.');
  activeFirestore = initializeFirestore(initializeApp(config), { experimentalForceLongPolling: true });
  return activeFirestore;
}

function writeJson(relativePath, payload) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(payload, null, 2), 'utf8');
  return absolutePath;
}

async function loadCampaignPlans(firestore, campaignId) {
  const campaignDocs = campaignId
    ? [await getCampaignSnapshot(firestore, campaignId)].filter(Boolean)
    : await getDocs(collection(firestore, 'campaigns'));
  const plans = [];

  for (const campaignSnap of campaignDocs.docs || campaignDocs) {
    const id = campaignSnap.id;
    const [effectsSnap, encountersSnap] = await Promise.all([
      getDocs(collection(firestore, 'campaigns', id, 'actorEffects')),
      getDocs(collection(firestore, 'campaigns', id, 'encounters')),
    ]);
    plans.push(buildLegacyConditionCleanupPlan({
      campaignId: id,
      effects: effectsSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() })),
      encounters: encountersSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() })),
    }));
  }
  return plans;
}

async function getCampaignSnapshot(firestore, campaignId) {
  const allCampaigns = await getDocs(collection(firestore, 'campaigns'));
  return allCampaigns.docs.find((snap) => snap.id === campaignId) || null;
}

async function writeCleanup(firestore, plans) {
  const affectedPlans = plans.filter((plan) => plan.counts.actorEffects || plan.counts.encounters);
  if (!affectedPlans.length) return null;

  const backupId = `legacy-condition-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const createdAt = new Date().toISOString();
  const operations = [];
  for (const plan of affectedPlans) {
    const backupRef = doc(firestore, 'migrationBackups', backupId, 'campaigns', plan.campaignId);
    operations.push({ type: 'set', ref: backupRef, data: {
      id: plan.campaignId,
      cleanup: 'legacy-condition-effects',
      createdAt,
      actorEffects: plan.effectSnapshots,
      encounters: plan.encounterUpdates.map((update) => ({ id: update.encounterId, combatants: update.originalCombatants })),
    } });
    plan.effectIds.forEach((effectId) => operations.push({
      type: 'delete',
      ref: doc(firestore, 'campaigns', plan.campaignId, 'actorEffects', effectId),
    }));
    plan.encounterUpdates.forEach((update) => operations.push({
      type: 'set',
      ref: doc(firestore, 'campaigns', plan.campaignId, 'encounters', update.encounterId),
      data: { combatants: update.cleanedCombatants, updatedAt: createdAt },
    }));
  }

  for (let start = 0; start < operations.length; start += 450) {
    const batch = writeBatch(firestore);
    operations.slice(start, start + 450).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data, { merge: true });
    });
    await batch.commit();
  }
  return backupId;
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnv();
  const firestore = createFirestore();
  const plans = await loadCampaignPlans(firestore, args.campaignId);
  const report = {
    mode: args.write ? 'write' : 'dry-run',
    createdAt: new Date().toISOString(),
    campaigns: plans.map((plan) => ({ campaignId: plan.campaignId, counts: plan.counts, effectIds: plan.effectIds, encounterIds: plan.encounterUpdates.map((update) => update.encounterId) })),
    totals: plans.reduce((totals, plan) => ({
      actorEffects: totals.actorEffects + plan.counts.actorEffects,
      encounters: totals.encounters + plan.counts.encounters,
      combatants: totals.combatants + plan.counts.combatants,
    }), { actorEffects: 0, encounters: 0, combatants: 0 }),
  };
  if (args.write) report.backupId = await writeCleanup(firestore, plans);
  const reportPath = writeJson(args.reportOut, report);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeFirestore) await terminate(activeFirestore).catch(() => {});
  });
