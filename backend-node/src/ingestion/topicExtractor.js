import { getLlm, invokeStructured } from "../services/llmClient.js";
import {
  CONCEPT_EXTRACTION_PROMPT,
  MISCONCEPTION_GENERATION_PROMPT,
  INTERVENTION_GENERATION_PROMPT,
  PROBLEM_GENERATION_PROMPT,
  EVALUATION_RULES_PROMPT,
} from "./ingestionPrompts.js";

export async function extractTopicPack(chapterContent, chapterTitle, topicId, llm = null) {
  if (!llm) {
    llm = getLlm(0.3); // a bit more creative for generation
  }

  const result = {
    topicId,
    manifest: {},
    conceptGraph: {},
    misconceptions: {},
    interventions: {},
    problems: {},
    evaluationRules: {},
  };

  const maxChars = 80000;
  const truncatedContent = chapterContent.substring(0, maxChars);

  console.log(`Pass 1/5: Extracting concepts from '${chapterTitle}'...`);
  let prompt = CONCEPT_EXTRACTION_PROMPT
    .replace("{chapter_title}", chapterTitle)
    .replace("{chapter_content}", truncatedContent)
    .replace("{topic_id}", topicId);

  const conceptsData = await invokeStructured(llm, prompt, "Extract concepts.");

  result.manifest = {
    topic_id: topicId,
    title: conceptsData.title || chapterTitle,
    version: "0.1.0",
    difficulty: conceptsData.difficulty || "intermediate",
    target_users: ["engineering_students"],
    description: conceptsData.description || `Auto-generated topic pack from: ${chapterTitle}`,
  };

  result.conceptGraph = {
    topic_id: topicId,
    concepts: conceptsData.concepts || [],
  };

  const conceptsJson = JSON.stringify(result.conceptGraph.concepts, null, 2);
  const topicTitle = result.manifest.title;

  console.log("Pass 2/5: Generating misconceptions...");
  prompt = MISCONCEPTION_GENERATION_PROMPT
    .replace("{topic_title}", topicTitle)
    .replace("{concepts_json}", conceptsJson)
    .replace("{chapter_content}", truncatedContent.substring(0, 40000))
    .replace("{topic_id}", topicId);

  const misconceptionsData = await invokeStructured(llm, prompt, "Generate misconceptions.");
  result.misconceptions = misconceptionsData;

  const misconceptionsJson = JSON.stringify(misconceptionsData.items || [], null, 2);

  const allErrorTags = [];
  for (const item of misconceptionsData.items || []) {
    allErrorTags.push(...(item.error_tags || []));
  }

  console.log("Pass 3/5: Generating interventions...");
  prompt = INTERVENTION_GENERATION_PROMPT
    .replace("{topic_title}", topicTitle)
    .replace("{misconceptions_json}", misconceptionsJson)
    .replace("{chapter_content}", truncatedContent.substring(0, 40000))
    .replace("{topic_id}", topicId);

  const interventionsData = await invokeStructured(llm, prompt, "Generate interventions.");
  result.interventions = interventionsData;

  console.log("Pass 4/5: Generating practice problems...");
  const topicPrefix = topicId.split("_").slice(0, 2).map((w) => w.substring(0, 3)).join("_");
  prompt = PROBLEM_GENERATION_PROMPT
    .replace("{topic_title}", topicTitle)
    .replace("{topic_prefix}", topicPrefix)
    .replace("{concepts_json}", conceptsJson)
    .replace("{error_tags_json}", JSON.stringify([...new Set(allErrorTags)], null, 2))
    .replace("{topic_id}", topicId);

  const problemsData = await invokeStructured(llm, prompt, "Generate problems.");
  result.problems = problemsData;

  console.log("Pass 5/5: Generating evaluation rules...");
  prompt = EVALUATION_RULES_PROMPT
    .replace("{topic_title}", topicTitle)
    .replace("{concepts_json}", conceptsJson)
    .replace("{interventions_json}", JSON.stringify(interventionsData.rules || [], null, 2))
    .replace("{topic_id}", topicId);

  const evaluationData = await invokeStructured(llm, prompt, "Generate evaluation rules.");
  result.evaluationRules = evaluationData;

  console.log(`Extraction complete for topic '${topicId}'.`);
  return result;
}
