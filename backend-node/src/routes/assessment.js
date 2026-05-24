import { Router } from "express";
import {
  AssessmentAnswerRequestSchema,
  AssessmentPlanRequestSchema,
  AssessmentStartRequestSchema,
} from "../schemas/student.js";
import { assessmentService } from "../services/assessmentService.js";
import { OrchestratorService } from "../services/orchestratorService.js";

const router = Router();
const orchestratorService = new OrchestratorService();
const reqStamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

router.post("/assessment/start", (req, res, next) => {
  const reqId = reqStamp();
  console.log(`[assessment/start][${reqId}] incoming`);
  try {
    const parsed = AssessmentStartRequestSchema.parse(req.body);
    console.log(`[assessment/start][${reqId}] topic=${parsed.topic_id} student=${parsed.student_id || "guest"}`);
    const result = assessmentService.startAssessment({
      topicId: parsed.topic_id,
      studentId: parsed.student_id,
      goals: parsed.goals,
      availableHoursPerWeek: parsed.available_hours_per_week,
    });
    console.log(`[assessment/start][${reqId}] ok session=${result.session_id} total=${result.progress?.total}`);
    res.json(result);
  } catch (error) {
    console.error(`[assessment/start][${reqId}] error`, error?.message || error);
    if (error.name === "ZodError") {
      res.status(422).json({ detail: error.errors });
    } else if (error.status) {
      res.status(error.status).json({ detail: error.message });
    } else {
      next(error);
    }
  }
});

router.post("/assessment/answer", (req, res, next) => {
  const reqId = reqStamp();
  console.log(`[assessment/answer][${reqId}] incoming`);
  try {
    const parsed = AssessmentAnswerRequestSchema.parse(req.body);
    console.log(
      `[assessment/answer][${reqId}] session=${parsed.session_id} problem=${parsed.problem_id} selected=${parsed.selected_option}`
    );
    const result = assessmentService.submitAnswer({
      sessionId: parsed.session_id,
      problemId: parsed.problem_id,
      selectedOption: parsed.selected_option,
      timeSeconds: parsed.time_seconds ?? null,
    });
    console.log(
      `[assessment/answer][${reqId}] ok complete=${result.assessment_complete} answered=${result.progress?.answered}`
    );
    res.json(result);
  } catch (error) {
    console.error(`[assessment/answer][${reqId}] error`, error?.message || error);
    if (error.name === "ZodError") {
      res.status(422).json({ detail: error.errors });
    } else if (error.status) {
      res.status(error.status).json({ detail: error.message });
    } else {
      next(error);
    }
  }
});

router.post("/assessment/plan", async (req, res, next) => {
  const reqId = reqStamp();
  console.log(`[assessment/plan][${reqId}] incoming`);
  try {
    const parsed = AssessmentPlanRequestSchema.parse(req.body);
    console.log(`[assessment/plan][${reqId}] session=${parsed.session_id}`);
    const snapshot = assessmentService.buildSnapshot(parsed.session_id, {
      studentId: parsed.student_id,
      goals: parsed.goals,
      availableHoursPerWeek: parsed.available_hours_per_week,
    });
    console.log(
      `[assessment/plan][${reqId}] snapshot attempts=${snapshot.attempts.length} subject=${snapshot.profile.subject}`
    );
    const result = await orchestratorService.run(snapshot);
    console.log(`[assessment/plan][${reqId}] ok weakest=${result?.diagnosis?.weakest_concept || "n/a"}`);
    res.json(result);
  } catch (error) {
    console.error(`[assessment/plan][${reqId}] error`, error?.detail || error?.message || error);
    if (error.name === "ZodError") {
      res.status(422).json({ detail: error.errors });
    } else if (error.status) {
      res.status(error.status).json({
        detail: error.detail || error.message,
        ...(error.requires_initial_assessment ? { requires_initial_assessment: true } : {}),
      });
    } else {
      next(error);
    }
  }
});

export default router;
