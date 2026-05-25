import neo4j from "neo4j-driver";
import settings from "../config.js";

function disabledSummary() {
  return {
    enabled: false,
    detail: "Neo4j is not configured.",
  };
}

async function run() {
  if (!settings.neo4jUri || !settings.neo4jUser || !settings.neo4jPassword) {
    console.log(JSON.stringify(disabledSummary(), null, 2));
    return;
  }

  const driver = neo4j.driver(
    settings.neo4jUri,
    neo4j.auth.basic(settings.neo4jUser, settings.neo4jPassword)
  );
  const session = driver.session({ database: settings.neo4jDatabase });

  try {
    try {
      const orphanMisconceptions = await session.run(
        `
        MATCH (m:Misconception)
        WHERE NOT (m)-[:ABOUT]->(:Concept)
        RETURN count(m) AS count
        `
      );
      const orphanQuestions = await session.run(
        `
        MATCH (q:Question)
        WHERE NOT (q)-[:TESTS]->(:Concept)
        RETURN count(q) AS count
        `
      );
      const counts = await session.run(
        `
        MATCH (c:Concept) WITH count(c) AS concepts
        MATCH (m:Misconception) WITH concepts, count(m) AS misconceptions
        MATCH (q:Question) WITH concepts, misconceptions, count(q) AS questions
        RETURN concepts, misconceptions, questions
        `
      );

      const summary = counts.records[0];
      console.log(
        JSON.stringify(
          {
            enabled: true,
            concepts: summary.get("concepts").toNumber(),
            misconceptions: summary.get("misconceptions").toNumber(),
            questions: summary.get("questions").toNumber(),
            orphan_misconceptions: orphanMisconceptions.records[0].get("count").toNumber(),
            orphan_questions: orphanQuestions.records[0].get("count").toNumber(),
          },
          null,
          2
        )
      );
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            enabled: true,
            available: false,
            detail: error?.message || "Could not reach Neo4j for integrity check.",
          },
          null,
          2
        )
      );
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
