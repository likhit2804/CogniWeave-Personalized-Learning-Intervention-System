import { Router } from "express";
import { KnowledgeBase } from "../services/knowledgeBase.js";

const router = Router();

router.get("/evaluation/problems/:topicId/:conceptId", (req, res, next) => {
  try {
    const { topicId, conceptId } = req.params;
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

    const selectedProblem = matchingProblems[Math.floor(Math.random() * matchingProblems.length)];
    res.json(selectedProblem);
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
        feedback: "Correct! You have mastered this concept.",
      });
    } else {
      res.json({
        mastery_achieved: false,
        replan_required: true,
        feedback: `Incorrect. The correct answer was ${problem.correct_option}.`,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
