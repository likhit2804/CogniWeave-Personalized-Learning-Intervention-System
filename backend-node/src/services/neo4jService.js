import neo4j from "neo4j-driver";
import settings from "../config.js";

let driver = null;

function hasConfig() {
  return Boolean(settings.neo4jUri && settings.neo4jUser && settings.neo4jPassword);
}

export function isNeo4jEnabled() {
  return hasConfig();
}

export function getNeo4jDriver() {
  if (!hasConfig()) return null;
  if (driver) return driver;

  driver = neo4j.driver(
    settings.neo4jUri,
    neo4j.auth.basic(settings.neo4jUser, settings.neo4jPassword)
  );
  return driver;
}

export async function closeNeo4j() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function upsertKnowledgeGraphPack(pack) {
  const graphDriver = getNeo4jDriver();
  if (!graphDriver) return { enabled: false, written: 0 };

  const session = graphDriver.session({ database: settings.neo4jDatabase });
  let writes = 0;

  try {
    await ensureConstraints(session);

    const concepts = Array.isArray(pack?.concepts)
      ? pack.concepts
      : Array.isArray(pack?.conceptGraph?.concepts)
        ? pack.conceptGraph.concepts
        : [];
    const misconceptions = Array.isArray(pack?.misconceptions)
      ? pack.misconceptions
      : Array.isArray(pack?.misconceptions?.items)
        ? pack.misconceptions.items
        : [];
    const problems = Array.isArray(pack?.problems)
      ? pack.problems
      : Array.isArray(pack?.problems?.items)
        ? pack.problems.items
        : [];

    for (const concept of concepts) {
      await session.run(
        `
        MERGE (c:Concept {concept_id: $concept_id})
        SET c.name = $name,
            c.description = $description
        `,
        {
          concept_id: concept.concept_id || concept.id || concept.name || concept.label,
          name: concept.name || concept.label || concept.concept_id || concept.id || "unknown",
          description: concept.description || null,
        }
      );
      writes += 1;
    }

    // Link concept prerequisites
    for (const concept of concepts) {
      const conceptId = concept.concept_id || concept.id || concept.name || concept.label;
      if (Array.isArray(concept.prerequisites)) {
        for (const prereqId of concept.prerequisites) {
          if (!prereqId) continue;
          await session.run(
            `
            MATCH (c:Concept {concept_id: $concept_id})
            MERGE (p:Concept {concept_id: $prereq_id})
            MERGE (p)-[:PREREQUISITE_OF]->(c)
            `,
            { concept_id: conceptId, prereq_id: prereqId }
          );
          writes += 1;
        }
      }
    }

    for (const misconception of misconceptions) {
      await session.run(
        `
        MERGE (m:Misconception {misconception_id: $misconception_id})
        SET m.label = $label,
            m.description = $description,
            m.error_tags = $error_tags
        `,
        {
          misconception_id:
            misconception.misconception_id || misconception.id || misconception.label,
          label: misconception.label || misconception.misconception_id || "unknown",
          description: misconception.description || null,
          error_tags: misconception.error_tags || [],
        }
      );
      writes += 1;

      const conceptId = misconception.concept_id || misconception.concept;
      if (conceptId) {
        await session.run(
          `
          MATCH (m:Misconception {misconception_id: $misconception_id})
          MATCH (c:Concept {concept_id: $concept_id})
          MERGE (m)-[:ABOUT]->(c)
          `,
          {
            misconception_id: misconception.misconception_id || misconception.id || misconception.label,
            concept_id: conceptId,
          }
        );
        writes += 1;
      }
    }

    for (const problem of problems) {
      const questionId = problem.problem_id || problem.id || problem.question || null;
      if (!questionId) continue;
      await session.run(
        `
        MERGE (q:Question {question_id: $question_id})
        SET q.prompt = $prompt,
            q.difficulty = $difficulty
        `,
        {
          question_id: questionId,
          prompt: problem.question || problem.prompt || null,
          difficulty: problem.difficulty || null,
        }
      );
      writes += 1;

      const conceptIds = Array.isArray(problem.concept_ids)
        ? problem.concept_ids
        : [problem.concept || problem.concept_id].filter(Boolean);

      for (const conceptId of conceptIds) {
        await session.run(
          `
          MATCH (q:Question {question_id: $question_id})
          MATCH (c:Concept {concept_id: $concept_id})
          MERGE (q)-[:TESTS]->(c)
          `,
          { question_id: questionId, concept_id: conceptId }
        );
        writes += 1;
      }

      // Link questions to misconceptions via error tags
      const errorTags = Array.isArray(problem.expected_error_tags)
        ? problem.expected_error_tags
        : [problem.expected_error_tag].filter(Boolean);

      for (const errorTag of errorTags) {
        await session.run(
          `
          MATCH (q:Question {question_id: $question_id})
          MATCH (m:Misconception)
          WHERE $error_tag IN m.error_tags
          MERGE (q)-[:EXPOSES]->(m)
          `,
          { question_id: questionId, error_tag: errorTag }
        );
        writes += 1;
      }
    }

    return { enabled: true, written: writes };
  } finally {
    await session.close();
  }
}

async function ensureConstraints(session) {
  await session.run(
    "CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE"
  );
  await session.run(
    "CREATE CONSTRAINT misconception_id_unique IF NOT EXISTS FOR (m:Misconception) REQUIRE m.misconception_id IS UNIQUE"
  );
  await session.run(
    "CREATE CONSTRAINT question_id_unique IF NOT EXISTS FOR (q:Question) REQUIRE q.question_id IS UNIQUE"
  );
}

export async function fetchQuestionContextForConcepts(conceptIds = [], limit = 10) {
  const graphDriver = getNeo4jDriver();
  if (!graphDriver || !Array.isArray(conceptIds) || conceptIds.length === 0) return [];

  const session = graphDriver.session({ database: settings.neo4jDatabase });
  try {
    const result = await session.run(
      `
      MATCH (c:Concept)<-[:ABOUT]-(m:Misconception)
      WHERE c.concept_id IN $concept_ids
      OPTIONAL MATCH (q:Question)-[:TESTS]->(c)
      OPTIONAL MATCH (q)-[:TARGETS_MISCONCEPTION]->(m)
      RETURN c.concept_id AS concept_id,
             c.name AS concept_name,
             m.misconception_id AS misconception_id,
             m.label AS misconception_label,
             q.question_id AS question_id,
             q.prompt AS question_prompt
      LIMIT $limit
      `,
      { concept_ids: conceptIds, limit: neo4j.int(limit) }
    );

    return result.records.map((record) => ({
      concept_id: record.get("concept_id"),
      concept_name: record.get("concept_name"),
      misconception_id: record.get("misconception_id"),
      misconception_label: record.get("misconception_label"),
      question_id: record.get("question_id"),
      question_prompt: record.get("question_prompt"),
    }));
  } finally {
    await session.close();
  }
}

export async function fetchPrerequisiteBottlenecks(conceptIds = []) {
  const graphDriver = getNeo4jDriver();
  if (!graphDriver || !Array.isArray(conceptIds) || conceptIds.length === 0) return [];

  const session = graphDriver.session({ database: settings.neo4jDatabase });
  try {
    const result = await session.run(
      `
      MATCH (prereq:Concept)-[:PREREQUISITE_OF*1..3]->(weak:Concept)
      WHERE weak.concept_id IN $concept_ids
        AND prereq.concept_id IN $concept_ids
      RETURN DISTINCT prereq.concept_id AS bottleneck, weak.concept_id AS blocked
      `,
      { concept_ids: conceptIds }
    );

    return result.records.map((record) => ({
      bottleneck: record.get("bottleneck"),
      blocked: record.get("blocked"),
    }));
  } finally {
    await session.close();
  }
}

