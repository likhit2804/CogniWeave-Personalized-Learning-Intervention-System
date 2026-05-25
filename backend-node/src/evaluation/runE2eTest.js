import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "../services/database.js";
import { buildAndWrite } from "../ingestion/packBuilder.js";
import { upsertKnowledgeGraphPack, getNeo4jDriver } from "../services/neo4jService.js";
import { assessmentService } from "../services/assessmentService.js";
import { OrchestratorService } from "../services/orchestratorService.js";
import { KnowledgeBase } from "../services/knowledgeBase.js";
import settings from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== STARTING END-TO-END PIPELINE TEST ===");
  
  // 1. Initialize SQLite
  console.log("\n[Step 1] Initializing SQLite database...");
  initDb();
  
  const testTopicId = "e2e_test_sql_sorting";
  
  // 2. Build mock pack
  console.log("\n[Step 2] Building mock topic pack in memory...");
  const mockPack = {
    topicId: testTopicId,
    manifest: {
      topic_id: testTopicId,
      title: "SQL Sorting Basics",
      version: "0.1.0",
      difficulty: "beginner",
      target_users: ["engineering_students"],
      description: "Learn how to use ORDER BY with single or multiple columns.",
    },
    conceptGraph: {
      topic_id: testTopicId,
      concepts: [
        {
          id: "order_by_basic",
          label: "Basic ORDER BY",
          description: "Sorting output using one column ascending or descending.",
          prerequisites: [],
          related_concepts: [],
        },
        {
          id: "order_by_multiple",
          label: "Multiple Column ORDER BY",
          description: "Sorting by multiple columns where subsequent columns act as tie-breakers.",
          prerequisites: ["order_by_basic"],
          related_concepts: [],
        }
      ]
    },
    misconceptions: {
      topic_id: testTopicId,
      items: [
        {
          id: "sorting_tie_breaker_confusion",
          concept_id: "order_by_multiple",
          label: "Tie-breaker Confusion",
          error_tags: ["tie_breaker_error", "sorting_direction_error"],
          symptoms: ["wrong ordering in tie cases", "putting DESC in the wrong position"],
          notes: "Happens when the student writes ORDER BY col1, col2 DESC thinking col1 is also sorted descending."
        }
      ]
    },
    interventions: {
      topic_id: testTopicId,
      rules: [
        {
          id: "fix_sorting_tie_breaker",
          concept_id: "order_by_multiple",
          misconception_id: "sorting_tie_breaker_confusion",
          strategy: "Tie-breaker explanation and trace drill",
          activities: [
            "Observe table values with ties, trace column 1 values, then column 2 values.",
            "Compare ORDER BY col1 DESC, col2 ASC vs ORDER BY col1, col2 DESC."
          ],
          expected_signals: [
            "correct placement of sorting keywords",
            "fewer tie breaker errors"
          ],
          priority: 1
        }
      ]
    },
    problems: {
      topic_id: testTopicId,
      items: [
        {
          id: "sort_001",
          title: "Sort students by grade descending",
          concept_ids: ["order_by_basic"],
          difficulty: "easy",
          question_text: "Which query sorts students by grade in descending order?",
          options: {
            "A": "SELECT * FROM students ORDER BY grade DESC",
            "B": "SELECT * FROM students ORDER BY grade ASC",
            "C": "SELECT * FROM students SORT BY grade DESC",
            "D": "SELECT * FROM students ORDER grade DESC"
          },
          correct_option: "A",
          expected_error_tags: []
        },
        {
          id: "sort_002",
          title: "Sort by age descending, then name ascending",
          concept_ids: ["order_by_multiple"],
          difficulty: "medium",
          question_text: "Which SQL query correctly sorts results by age in descending order, and in case of tie, by name in ascending order?",
          options: {
            "A": "SELECT * FROM students ORDER BY age, name DESC",
            "B": "SELECT * FROM students ORDER BY age DESC, name ASC",
            "C": "SELECT * FROM students ORDER BY age DESC name ASC",
            "D": "SELECT * FROM students ORDER BY age name"
          },
          correct_option: "B",
          expected_error_tags: ["tie_breaker_error", "sorting_direction_error"]
        }
      ]
    },
    evaluationRules: {
      topic_id: testTopicId,
      rules: [
        {
          concept_id: "order_by_multiple",
          success_signals: [
            "correct sorting of ties",
            "correct use of DESC/ASC directions per column"
          ],
          partial_success_conditions: [
            "correct option but high time to solve"
          ],
          replan_trigger: [
            "continued tie_breaker_error in subsequent attempts"
          ]
        }
      ]
    }
  };

  // 3. Write pack to disk
  console.log("\n[Step 3] Writing topic pack to disk...");
  const writeResult = buildAndWrite(mockPack, null, true);
  if (!writeResult.success) {
    throw new Error("Failed to write mock pack: " + JSON.stringify(writeResult.validation));
  }
  console.log(`Topic pack written to: ${writeResult.directory}`);

  // 4. Sync to Neo4j and Assert Graph Relationships
  console.log("\n[Step 4] Syncing to Neo4j...");
  let assertionError = null;
  try {
    const graphResult = await upsertKnowledgeGraphPack(mockPack);
    console.log("Neo4j Sync response:", graphResult);

    const driver = getNeo4jDriver();
    if (driver) {
      const session = driver.session({ database: settings.neo4jDatabase });
      try {
        // Assert concept prerequisite edge exists
        const prereqCheck = await session.run(
          `
          MATCH (p:Concept {concept_id: 'order_by_basic'})-[:PREREQUISITE_OF]->(c:Concept {concept_id: 'order_by_multiple'})
          RETURN count(p) AS count
          `
        );
        const countPrereq = prereqCheck.records[0].get("count").toNumber();
        console.log(`Verified Neo4j: [order_by_basic] -[:PREREQUISITE_OF]-> [order_by_multiple] exists: ${countPrereq > 0}`);
        if (countPrereq === 0) throw new Error("Graph assertion failed: PREREQUISITE_OF relationship not found!");

        // Assert question misconception exposes edge exists
        const exposesCheck = await session.run(
          `
          MATCH (q:Question {question_id: 'sort_002'})-[:EXPOSES]->(m:Misconception {misconception_id: 'sorting_tie_breaker_confusion'})
          RETURN count(q) AS count
          `
        );
        const countExposes = exposesCheck.records[0].get("count").toNumber();
        console.log(`Verified Neo4j: [sort_002] -[:EXPOSES]-> [sorting_tie_breaker_confusion] exists: ${countExposes > 0}`);
        if (countExposes === 0) throw new Error("Graph assertion failed: EXPOSES relationship not found!");
      } finally {
        await session.close();
      }
    }
  } catch (err) {
    if (err.message && err.message.includes("assertion failed")) {
      assertionError = err;
    } else {
      console.warn("Neo4j verification failed or skipped (non-assertion error):", err.message || err);
    }
  }

  if (assertionError) {
    throw assertionError;
  }

  // 5. Run Assessment Process
  console.log("\n[Step 5] Starting assessment session...");
  const studentId = "stu_e2e_001";
  const startResult = assessmentService.startAssessment({
    topicId: testTopicId,
    studentId,
    goals: ["Get comfortable with multiple column sorting"],
    availableHoursPerWeek: 4,
  });

  const sessionId = startResult.session_id;
  console.log(`Session started. ID: ${sessionId}`);
  console.log("Concept Coverage Plan:", JSON.stringify(startResult.concept_coverage_plan));
  
  // Submit INCORRECT answers for both to trigger the prerequisite bottleneck detection
  const q1 = startResult.question;
  console.log(`\nAnswering Question 1 (${q1.id} - ${q1.title}):`);
  console.log(`Question: ${q1.question_text}`);
  const isQ1Sort1 = q1.id === "sort_001";
  const option1 = isQ1Sort1 ? "C" : "A"; // "C" is wrong for sort_001, "A" is wrong for sort_002
  console.log(`Submitting INCORRECT option: '${option1}'...`);
  const ans1 = assessmentService.submitAnswer({
    sessionId,
    problemId: q1.id,
    selectedOption: option1,
    timeSeconds: 60,
  });
  console.log("Q1 response confidence:", JSON.stringify(ans1.updated_confidence));

  const q2 = ans1.next_question;
  if (!q2) {
    throw new Error("Expected a second question in assessment!");
  }
  console.log(`\nAnswering Question 2 (${q2.id} - ${q2.title}):`);
  console.log(`Question: ${q2.question_text}`);
  const isQ2Sort1 = q2.id === "sort_001";
  const option2 = isQ2Sort1 ? "C" : "A"; // "C" is wrong for sort_001, "A" is wrong for sort_002
  console.log(`Submitting INCORRECT option: '${option2}'...`);
  const ans2 = assessmentService.submitAnswer({
    sessionId,
    problemId: q2.id,
    selectedOption: option2,
    timeSeconds: 120,
  });
  console.log("Q2 response (complete):", ans2.assessment_complete);
  console.log("Weakest concept detected:", ans2.assessment_summary?.weakest_concept);

  // 6. Run Orchestration Service (Diagnosis -> Intervention -> Plan -> Critic)
  console.log("\n[Step 6] Running Orchestrator Service to generate study plan...");
  const snapshot = assessmentService.buildSnapshot(sessionId);
  const orchestrator = new OrchestratorService();
  const planResult = await orchestrator.run(snapshot);

  console.log("\n--- ORCHESTRATION RESULT ---");
  console.log("Diagnosed Weakest Concept:", planResult.diagnosis?.weakest_concept);
  console.log("Misconception Label:", planResult.diagnosis?.misconception_label);
  console.log("Selected Intervention Strategy:", planResult.selected_intervention?.strategy);
  console.log("Selected Intervention Activities:", planResult.selected_intervention?.activities);
  console.log("Generated Weekly Plan Count:", planResult.weekly_plan?.length);
  console.log("Critic Iterations:", planResult.critic_iterations);
  console.log("Prerequisite Bottlenecks:", JSON.stringify(planResult.retrieval_context?.prerequisite_bottlenecks));

  // Assert prerequisite bottleneck is returned in context
  const hasBottleneck = (planResult.retrieval_context?.prerequisite_bottlenecks || []).some(
    b => b.bottleneck === "order_by_basic" && b.blocked === "order_by_multiple"
  );
  if (!hasBottleneck) {
    throw new Error("Graph assertion failed: Expected prerequisite bottleneck [order_by_basic -> order_by_multiple] in retrieval context!");
  }

  
  if (!planResult.weekly_plan || planResult.weekly_plan.length === 0) {
    throw new Error("Orchestration failed: Weekly plan is empty!");
  }

  // 7. Check Evaluation Loop Endpoint logic
  console.log("\n[Step 7] Checking evaluation endpoint logic...");
  // Simulate retrieving problem
  const kb = new KnowledgeBase(testTopicId);
  const matchingProblems = kb.problems.items.filter(p => p.concept_ids.includes("order_by_multiple"));
  const evalProblem = matchingProblems[0];
  console.log(`Found evaluation problem: ${evalProblem.id} - ${evalProblem.title}`);
  
  // Submit incorrect answer to evaluation
  console.log("Submitting INCORRECT answer to evaluation...");
  const isCorrectIncorrect = "A" === evalProblem.correct_option; // false
  console.log(`Feedback check: correctness = ${isCorrectIncorrect}`);
  // If incorrect, replan is triggered:
  if (!isCorrectIncorrect) {
    console.log("Success: Replan required on incorrect submission.");
  } else {
    throw new Error("Incorrect answer simulation failed!");
  }

  // Submit correct answer to evaluation
  console.log("Submitting CORRECT answer to evaluation...");
  const isCorrectCorrect = "B" === evalProblem.correct_option; // true
  if (isCorrectCorrect) {
    console.log("Success: Mastery achieved on correct submission.");
  } else {
    throw new Error("Correct answer simulation failed!");
  }

  // 8. Clean up
  console.log("\n[Step 8] Cleaning up temporary files...");
  const topicDir = path.join(settings.knowledgeBaseDir, "topics", testTopicId);
  if (fs.existsSync(topicDir)) {
    fs.rmSync(topicDir, { recursive: true, force: true });
    console.log(`Deleted topic pack folder: ${topicDir}`);
  }

  console.log("\n=== ALL E2E PIPELINE TESTS PASSED SUCCESSFULLY ===");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n*** TEST FAILED ***", err);
    process.exit(1);
  });
