import { getWeakConcepts } from "./mongoService.js";
import { fetchQuestionContextForConcepts } from "./neo4jService.js";

export async function buildQuestionGenerationContext(studentId, fallbackConcepts = []) {
  const weakConcepts = await getWeakConcepts(studentId, 5);
  const conceptIds =
    weakConcepts.length > 0 ? weakConcepts : (Array.isArray(fallbackConcepts) ? fallbackConcepts : []);

  const graphContext = await fetchQuestionContextForConcepts(conceptIds, 20);

  return {
    target_concepts: conceptIds,
    graph_context: graphContext,
  };
}
