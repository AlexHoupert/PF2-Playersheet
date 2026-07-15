import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { initializeApp } = require("firebase/app");
const {
  collection,
  getDocs,
  initializeFirestore,
  terminate,
} = require("firebase/firestore");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const campaignId = readCampaignId(process.argv);

loadDotEnv();

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
});
const firestore = initializeFirestore(app, { experimentalForceLongPolling: true });

try {
  const collectionNames = ["loreArticles", "loreGroups", "loreDeliveries", "knowledgeNotes"];
  const [sourceSnapshot, actorSnapshot, backupSnapshot, ...targetSnapshots] = await Promise.all([
    getDocs(collection(firestore, "loreArticles")),
    getDocs(collection(firestore, "campaigns", campaignId, "actors")),
    getDocs(collection(firestore, "migrationBackups")),
    ...collectionNames.map((collectionName) => (
      getDocs(collection(firestore, "campaigns", campaignId, collectionName))
    )),
  ]);
  const latestBackup = backupSnapshot.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((entry) => entry.type === "lore-campaign-migration" && entry.campaignId === campaignId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const activePcActors = actorSnapshot.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((actor) => actor.kind === "pc" && !actor.deletedAt)
    .map(({ id, name }) => ({ id, name }));
  const deliveryCountsByActor = targetSnapshots[2].docs.reduce((counts, snapshot) => {
    const actorId = snapshot.data().actorId;
    counts[actorId] = (counts[actorId] || 0) + 1;
    return counts;
  }, {});
  const sourceArticleIds = sourceSnapshot.docs.map((snapshot) => snapshot.id).sort();
  const targetArticleIds = targetSnapshots[0].docs.map((snapshot) => snapshot.id).sort();

  console.log(JSON.stringify({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    campaignId,
    targetCounts: Object.fromEntries(collectionNames.map((collectionName, index) => (
      [collectionName, targetSnapshots[index].size]
    ))),
    integrity: {
      topLevelSourceArticles: sourceSnapshot.size,
      sourceArticleIdsMatch: JSON.stringify(sourceArticleIds) === JSON.stringify(targetArticleIds),
      expectedDeliveries: sourceSnapshot.size * activePcActors.length,
      deliveryCountsByActor: activePcActors.map((actor) => ({
        ...actor,
        deliveries: deliveryCountsByActor[actor.id] || 0,
      })),
    },
    backup: latestBackup ? {
      id: latestBackup.id,
      createdAt: latestBackup.createdAt,
      sourceRetained: latestBackup.sourceRetained,
      sourceArticles: Array.isArray(latestBackup.sourceArticles) ? latestBackup.sourceArticles.length : null,
      counts: latestBackup.report?.counts || null,
    } : null,
  }, null, 2));
} finally {
  await terminate(firestore);
}

function readCampaignId(argv) {
  const index = argv.indexOf("--campaign");
  const value = index >= 0 ? argv[index + 1] : null;
  if (!value) throw new Error("Use --campaign <campaignId>.");
  return value;
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
