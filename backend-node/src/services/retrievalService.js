import { getWeakConcepts } from "./mongoService.js";
import { fetchQuestionContextForConcepts } from "./neo4jService.js";

export async function buildQuestionGenerationContext(studentId, fallbackConcepts = []) {
  const weakConcepts = await getWeakConcepts(studentId, 5);
  const conceptIds =
    weakConcepts.length > 0 ? weakConcepts : (Array.isArray(fallbackConcepts) ? fallbackConcepts : []);

  let graphContext = [];
  try {
    graphContext = await fetchQuestionContextForConcepts(conceptIds, 20);
  } catch (_error) {
    // Degrade gracefully when Neo4j is temporarily unavailable.
    graphContext = [];
  }

  return {
    target_concepts: conceptIds,
    graph_context: graphContext,
  };
}
