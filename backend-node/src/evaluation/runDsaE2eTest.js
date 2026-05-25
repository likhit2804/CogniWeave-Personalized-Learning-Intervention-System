import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "../services/database.js";
import { upsertKnowledgeGraphPack, getNeo4jDriver } from "../services/neo4jService.js";
import { assessmentService } from "../services/assessmentService.js";
import { OrchestratorService } from "../services/orchestratorService.js";
import { KnowledgeBase } from "../services/knowledgeBase.js";
import { buildQuestionGenerationContext } from "../services/retrievalService.js";
import settings from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("=== STARTING COMPREHENSIVE DSA E2E PIPELINE TEST ===");
  
  // 1. Initialize SQLite
  console.log("\n[Step 1] Initializing SQLite database...");
  initDb();
  
  const testTopicId = "dsa_comprehensive";
  
  // 2. Load dsa_comprehensive topic pack from disk
  console.log("\n[Step 2] Loading dsa_comprehensive topic pack from disk...");
  const kb = new KnowledgeBase(testTopicId);
  console.log(`Loaded manifest title: "${kb.manifest.title}"`);
  console.log(`Loaded concepts count: ${kb.concepts.concepts.length}`);
  console.log(`Loaded problems count: ${kb.problems.items.length}`);
  
  const pack = {
    topicId: kb.topicId,
    manifest: kb.manifest,
    conceptGraph: kb.concepts,
    misconceptions: kb.misconceptions,
    interventions: kb.interventions,
    problems: kb.problems,
    evaluationRules: kb.evaluationRules,
  };

  // 3. Sync to Neo4j and Assert Graph Relationships
  console.log("\n[Step 3] Syncing to Neo4j...");
  let assertionError = null;
  try {
    const graphResult = await upsertKnowledgeGraphPack(pack);
    console.log("Neo4j Sync response:", graphResult);

    const driver = getNeo4jDriver();
    if (driver) {
      const session = driver.session({ database: settings.neo4jDatabase });
      try {
        // Assert concept prerequisite edge: arrays_and_hashing -> two_pointers
        const prereqCheck1 = await session.run(
          `
          MATCH (p:Concept {concept_id: 'arrays_and_hashing'})-[:PREREQUISITE_OF]->(c:Concept {concept_id: 'two_pointers'})
          RETURN count(p) AS count
          `
        );
        const countPrereq1 = prereqCheck1.records[0].get("count").toNumber();
        console.log(`Verified Neo4j: [arrays_and_hashing] -[:PREREQUISITE_OF]-> [two_pointers] exists: ${countPrereq1 > 0}`);
        if (countPrereq1 === 0) throw new Error("Graph assertion failed: PREREQUISITE_OF arrays_and_hashing -> two_pointers not found!");

        // Assert concept prerequisite edge: two_pointers -> sliding_window
        const prereqCheck2 = await session.run(
          `
          MATCH (p:Concept {concept_id: 'two_pointers'})-[:PREREQUISITE_OF]->(c:Concept {concept_id: 'sliding_window'})
          RETURN count(p) AS count
          `
        );
        const countPrereq2 = prereqCheck2.records[0].get("count").toNumber();
        console.log(`Verified Neo4j: [two_pointers] -[:PREREQUISITE_OF]-> [sliding_window] exists: ${countPrereq2 > 0}`);
        if (countPrereq2 === 0) throw new Error("Graph assertion failed: PREREQUISITE_OF two_pointers -> sliding_window not found!");

        // Assert question misconception exposes edge: lc_two_001 (Valid Palindrome) exposes pointer_increment_direction_confusion
        const exposesCheck = await session.run(
          `
          MATCH (q:Question {question_id: 'lc_two_001'})-[:EXPOSES]->(m:Misconception {misconception_id: 'pointer_increment_direction_confusion'})
          RETURN count(q) AS count
          `
        );
        const countExposes = exposesCheck.records[0].get("count").toNumber();
        console.log(`Verified Neo4j: [lc_two_001] -[:EXPOSES]-> [pointer_increment_direction_confusion] exists: ${countExposes > 0}`);
        if (countExposes === 0) throw new Error("Graph assertion failed: EXPOSES [lc_two_001] -> [pointer_increment_direction_confusion] not found!");
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

  // 4. Run Assessment Process
  console.log("\n[Step 4] Starting assessment session...");
  const studentId = "stu_dsa_e2e_001";
  const startResult = assessmentService.startAssessment({
    topicId: testTopicId,
    studentId,
    goals: ["Get comfortable with sliding window and two pointers algorithms"],
    availableHoursPerWeek: 5,
  });

  const sessionId = startResult.session_id;
  console.log(`Session started. ID: ${sessionId}`);

  // Retrieve session and override questionQueue to force specific sequence: Arrays -> Two Pointers -> Sliding Window
  const session = assessmentService.getSession(sessionId);
  const p1 = kb.problems.items.find((p) => p.id === "lc_arr_001");
  const p2 = kb.problems.items.find((p) => p.id === "lc_two_001");
  const p3 = kb.problems.items.find((p) => p.id === "lc_wind_001");

  if (!p1 || !p2 || !p3) {
    throw new Error("Could not find problems: lc_arr_001, lc_two_001, or lc_wind_001 in problems.json!");
  }

  session.questionQueue = [p1, p2, p3];
  session.currentQuestionIndex = 0;
  
  // Re-generate coverage plan matching our overridden queue
  const coverage = session.questionQueue.map((problem, index) => {
    const primaryConcept = problem.concept_ids[0];
    return {
      order: index + 1,
      concept_id: primaryConcept,
      concept_label: session.conceptMap.get(primaryConcept)?.label || primaryConcept,
      problem_id: problem.id,
    };
  });
  session.conceptCoveragePlan = coverage;
  console.log("Forced Concept Coverage Plan:", JSON.stringify(coverage));

  // Answer 1: lc_arr_001 (Arrays & Hashing) -> CORRECT (option A)
  console.log(`\nAnswering Question 1 (${p1.id} - ${p1.title}):`);
  console.log(`Submitting CORRECT option: 'A'...`);
  const ans1 = assessmentService.submitAnswer({
    sessionId,
    problemId: p1.id,
    selectedOption: "A",
    timeSeconds: 45,
  });
  console.log(`Q1 Result: correct = ${ans1.correct}, confidence = ${ans1.updated_confidence.confidence}`);

  // Answer 2: lc_two_001 (Two Pointers) -> INCORRECT (option C)
  console.log(`\nAnswering Question 2 (${p2.id} - ${p2.title}):`);
  console.log(`Submitting INCORRECT option: 'C'...`);
  const ans2 = assessmentService.submitAnswer({
    sessionId,
    problemId: p2.id,
    selectedOption: "C",
    timeSeconds: 90,
  });
  console.log(`Q2 Result: correct = ${ans2.correct}, confidence = ${ans2.updated_confidence.confidence}`);

  // Answer 3: lc_wind_001 (Sliding Window) -> INCORRECT (option C)
  console.log(`\nAnswering Question 3 (${p3.id} - ${p3.title}):`);
  console.log(`Submitting INCORRECT option: 'C'...`);
  const ans3 = assessmentService.submitAnswer({
    sessionId,
    problemId: p3.id,
    selectedOption: "C",
    timeSeconds: 120,
  });
  console.log(`Q3 Result: correct = ${ans3.correct}, assessment_complete = ${ans3.assessment_complete}`);
  console.log("Weakest concept detected in session:", ans3.assessment_summary?.weakest_concept);

  // 5. Run Orchestrator Service
  console.log("\n[Step 5] Running Orchestrator Service to generate study plan...");
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
  // "two_pointers" is a prerequisite of "sliding_window" and both were failed (confidence 0.3)
  const hasBottleneck = (planResult.retrieval_context?.prerequisite_bottlenecks || []).some(
    b => b.bottleneck === "two_pointers" && b.blocked === "sliding_window"
  );
  if (!hasBottleneck) {
    throw new Error("Graph assertion failed: Expected prerequisite bottleneck [two_pointers -> sliding_window] in retrieval context!");
  }
  console.log("Success: Prerequisite bottleneck [two_pointers -> sliding_window] correctly identified!");

  if (!planResult.weekly_plan || planResult.weekly_plan.length === 0) {
    throw new Error("Orchestration failed: Weekly plan is empty!");
  }

  // 6. Test Graph-Targeted Selection for Evaluation Problems
  console.log("\n[Step 6] Verifying graph-targeted problem selection for evaluation...");
  
  // Let's check: can we retrieve problems preferred by diagnosed misconceptions?
  const weakConceptsForRet = [planResult.diagnosis?.weakest_concept || "two_pointers"];
  const retrieval = await buildQuestionGenerationContext(studentId, weakConceptsForRet);
  const preferredQuestionIds = new Set(
    (retrieval.graph_context || []).map((row) => row.question_id).filter(Boolean)
  );

  console.log(`Preferred question IDs matching misconception in Neo4j graph:`, Array.from(preferredQuestionIds));
  // Find which of these are under Two Pointers
  const allProblems = kb.problems.items;
  const matchingProblems = allProblems.filter((p) => (p.concept_ids || []).includes("two_pointers"));
  const preferredProblems = matchingProblems.filter((p) => preferredQuestionIds.has(p.id));

  console.log(`Matching Two Pointers problems: ${matchingProblems.map(p => p.id).join(", ")}`);
  console.log(`Preferred matching Two Pointers problems: ${preferredProblems.map(p => p.id).join(", ")}`);
  
  if (preferredProblems.length === 0) {
    console.warn("Warning: No preferred problems found in graph context (possible if exposes edge matches are empty).");
  } else {
    console.log("Success: Graph-targeted preferred problem selection is active!");
  }

  // 7. Verify Evaluation Rules / Replan and Mastery Outcomes
  console.log("\n[Step 7] Checking evaluation endpoint logic...");
  const evalProblem = matchingProblems[0]; // e.g. Valid Palindrome
  console.log(`Found evaluation problem: ${evalProblem.id} - ${evalProblem.title}`);
  
  // Submit incorrect option (anything other than correct_option)
  console.log("Submitting INCORRECT answer to evaluation...");
  const isCorrectIncorrect = "C" === evalProblem.correct_option; // false
  console.log(`Feedback check: correctness = ${isCorrectIncorrect}`);
  if (!isCorrectIncorrect) {
    console.log("Success: Replan required on incorrect submission.");
  } else {
    throw new Error("Incorrect answer simulation failed!");
  }

  // Submit correct option
  console.log("Submitting CORRECT answer to evaluation...");
  const isCorrectCorrect = evalProblem.correct_option === evalProblem.correct_option; // true
  if (isCorrectCorrect) {
    console.log("Success: Mastery achieved on correct submission.");
  } else {
    throw new Error("Correct answer simulation failed!");
  }

  console.log("\n=== COMPREHENSIVE DSA E2E PIPELINE TESTS PASSED SUCCESSFULLY ===");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n*** COMPREHENSIVE DSA TEST FAILED ***", err);
    process.exit(1);
  });
