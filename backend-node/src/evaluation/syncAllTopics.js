import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KnowledgeBase } from "../services/knowledgeBase.js";
import { upsertKnowledgeGraphPack, closeNeo4j } from "../services/neo4jService.js";
import settings from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== SYNCING ALL TOPIC PACKS TO NEO4J GRAPH ===");
  
  const topicsDir = path.join(settings.knowledgeBaseDir, "topics");
  if (!fs.existsSync(topicsDir)) {
    console.error(`Topics directory not found at: ${topicsDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(topicsDir, { withFileTypes: true });
  let totalSynced = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const topicId = entry.name;
      console.log(`\nProcessing topic pack: ${topicId}...`);
      
      try {
        const kb = new KnowledgeBase(topicId);
        
        // Structure the pack exactly as expected by upsertKnowledgeGraphPack
        const pack = {
          topicId: kb.topicId,
          manifest: kb.manifest,
          conceptGraph: kb.concepts,
          misconceptions: kb.misconceptions,
          interventions: kb.interventions,
          problems: kb.problems,
          evaluationRules: kb.evaluationRules,
        };

        const result = await upsertKnowledgeGraphPack(pack);
        if (result.enabled) {
          console.log(`Successfully synced topic '${topicId}'. Written relations/nodes: ${result.written}`);
          totalSynced += 1;
        } else {
          console.log(`Skipped topic '${topicId}': Neo4j is not enabled or configured.`);
        }
      } catch (err) {
        console.error(`Error syncing topic '${topicId}':`, err.message || err);
      }
    }
  }

  await closeNeo4j();
  console.log(`\n=== SYNC COMPLETE. Synced ${totalSynced} topics to Neo4j. ===`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Sync script failed:", err);
    process.exit(1);
  });
