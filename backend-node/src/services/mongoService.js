import { MongoClient } from "mongodb";
import settings from "../config.js";

let client = null;

export function isMongoEnabled() {
  return Boolean(settings.mongoUri);
}

async function getClient() {
  if (!isMongoEnabled()) return null;
  if (client) return client;
  client = new MongoClient(settings.mongoUri);
  await client.connect();
  return client;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
  }
}

async function getDb() {
  const connectedClient = await getClient();
  if (!connectedClient) return null;
  return connectedClient.db(settings.mongoDbName);
}

export async function upsertLearnerState({
  studentId,
  profile = {},
  confidenceByConcept = {},
  weakConcepts = [],
}) {
  const db = await getDb();
  if (!db || !studentId) return { enabled: false };

  await db.collection("learner_state").updateOne(
    { student_id: studentId },
    {
      $set: {
        student_id: studentId,
        profile,
        confidence_by_concept: confidenceByConcept,
        weak_concepts: weakConcepts,
        updated_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return { enabled: true };
}

export async function recordAttemptEvent(event) {
  const db = await getDb();
  if (!db) return { enabled: false };
  await db.collection("attempt_events").insertOne({
    ...event,
    created_at: new Date().toISOString(),
  });
  return { enabled: true };
}

export async function getWeakConcepts(studentId, limit = 5) {
  const db = await getDb();
  if (!db || !studentId) return [];

  const learner = await db.collection("learner_state").findOne(
    { student_id: studentId },
    { projection: { weak_concepts: 1, confidence_by_concept: 1 } }
  );
  if (!learner) return [];

  if (Array.isArray(learner.weak_concepts) && learner.weak_concepts.length > 0) {
    return learner.weak_concepts.slice(0, limit);
  }

  const confidence = learner.confidence_by_concept || {};
  return Object.entries(confidence)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([concept]) => concept);
}
