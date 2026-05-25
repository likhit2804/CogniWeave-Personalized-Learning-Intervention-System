import { Router } from "express";
import { KnowledgeBase } from "../services/knowledgeBase.js";
import { buildQuestionGenerationContext } from "../services/retrievalService.js";

const router = Router();

function publicProblem(problem) {
  return {
    id: problem.id,
    title: problem.title,
    concept_ids: problem.concept_ids || [],
    difficulty: problem.difficulty,
    question_text: problem.question_text,
    options: problem.options || {},
    expected_error_tags: problem.expected_error_tags || [],
  };
}

router.get("/evaluation/problems/:topicId/:conceptId", async (req, res, next) => {
  try {
    const { topicId, conceptId } = req.params;
    const studentId = req.query.student_id || null;
    let kb;
    try {
      kb = new KnowledgeBase(topicId);
    } catch (err) {
      return res.status(404).json({ detail: "Topic not found" });
    }

    const allProblems = kb.problems?.items || [];
    const matchingProblems = allProblems.filter((p) =>
      (p.concept_ids || []).includes(conceptId)
    );

    if (matchingProblems.length === 0) {
      return res.status(404).json({ detail: `No problems found for concept ${conceptId}` });
    }

    let selectedProblem = matchingProblems[Math.floor(Math.random() * matchingProblems.length)];

    if (studentId) {
      const retrieval = await buildQuestionGenerationContext(studentId, [conceptId]);
      const preferredQuestionIds = new Set(
        (retrieval.graph_context || []).map((row) => row.question_id).filter(Boolean)
      );
      if (preferredQuestionIds.size > 0) {
        const preferred = matchingProblems.filter((p) => preferredQuestionIds.has(p.id));
        if (preferred.length > 0) {
          selectedProblem = preferred[Math.floor(Math.random() * preferred.length)];
        }
      }
    }

    res.json(publicProblem(selectedProblem));
  } catch (err) {
    next(err);
  }
});

router.post("/evaluation/evaluate", (req, res, next) => {
  try {
    const topicId = req.query.topic_id;
    if (!topicId) {
      return res.status(400).json({ detail: "topic_id query param is required" });
    }

    const { problem_id, selected_option } = req.body;
    let kb;
    try {
      kb = new KnowledgeBase(topicId);
    } catch (err) {
      return res.status(404).json({ detail: "Topic not found" });
    }

    const problem = (kb.problems?.items || []).find((p) => p.id === problem_id);
    if (!problem) {
      return res.status(404).json({ detail: "Problem not found" });
    }

    const isCorrect = selected_option === problem.correct_option;

    if (isCorrect) {
      res.json({
        mastery_achieved: true,
        replan_required: false,
        feedback: "Correct. This checkpoint suggests the learner is moving in the right direction.",
      });
    } else {
      res.json({
        mastery_achieved: false,
        replan_required: true,
        feedback: "Not quite. This miss will be used to adjust the next plan rather than relying on manual form input.",
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
