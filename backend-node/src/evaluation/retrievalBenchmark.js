import settings from "../config.js";
import { MongoClient } from "mongodb";
import { buildQuestionGenerationContext } from "../services/retrievalService.js";

async function run() {
  if (!settings.mongoUri) {
    console.log(
      JSON.stringify(
        { enabled: false, detail: "MongoDB is not configured." },
        null,
        2
      )
    );
    return;
  }

  const client = new MongoClient(settings.mongoUri);
  await client.connect();
  try {
    const db = client.db(settings.mongoDbName);
    const learners = await db
      .collection("learner_state")
      .find({}, { projection: { student_id: 1 } })
      .limit(25)
      .toArray();

    let withGraphContext = 0;
    let totalContextRows = 0;

    for (const learner of learners) {
      const studentId = learner.student_id;
      if (!studentId) continue;
      const context = await buildQuestionGenerationContext(studentId, []);
      const rows = (context.graph_context || []).length;
      if (rows > 0) withGraphContext += 1;
      totalContextRows += rows;
    }

    const learnerCount = learners.length;
    const coverage = learnerCount > 0 ? withGraphContext / learnerCount : 0;

    console.log(
      JSON.stringify(
        {
          enabled: true,
          learners_checked: learnerCount,
          learners_with_graph_context: withGraphContext,
          graph_context_coverage: Number(coverage.toFixed(3)),
          average_context_rows_per_learner:
            learnerCount > 0 ? Number((totalContextRows / learnerCount).toFixed(2)) : 0,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
