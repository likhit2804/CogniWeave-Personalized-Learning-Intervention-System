import { randomUUID } from "node:crypto";
import { KnowledgeBase } from "./knowledgeBase.js";

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function publicProblem(problem, conceptLabel = null) {
  return {
    id: problem.id,
    title: problem.title,
    concept_ids: problem.concept_ids || [],
    concept_label: conceptLabel,
    difficulty: problem.difficulty,
    question_text: problem.question_text,
    options: problem.options || {},
  };
}

function scoreToConfidence(correctCount, totalCount) {
  if (!totalCount) return 0.5;
  const ratio = correctCount / totalCount;
  return Number((0.3 + ratio * 0.4).toFixed(2));
}

function buildGuestStudentId(topicId) {
  return `guest_${topicId}_${randomUUID().slice(0, 8)}`;
}

function buildConceptMap(kb) {
  const concepts = kb.concepts?.concepts || [];
  const map = new Map();
  for (const concept of concepts) {
    map.set(concept.id, concept);
  }
  return map;
}

function pickAssessmentProblems(kb) {
  const allProblems = kb.problems?.items || [];
  if (allProblems.length === 0) {
    throw Object.assign(
      new Error("This topic pack has no assessment problems yet."),
      { status: 400 }
    );
  }

  const targetCount = Math.min(5, Math.max(3, Math.min(allProblems.length, 5)));
  const uniqueByConcept = [];
  const usedProblemIds = new Set();
  const conceptIds = shuffle([
    ...new Set(
      allProblems.flatMap((problem) => problem.concept_ids || []).filter(Boolean)
    ),
  ]);

  for (const conceptId of conceptIds) {
    const candidate = shuffle(
      allProblems.filter(
        (problem) =>
          !usedProblemIds.has(problem.id) &&
          (problem.concept_ids || []).includes(conceptId)
      )
    )[0];

    if (candidate) {
      uniqueByConcept.push(candidate);
      usedProblemIds.add(candidate.id);
    }

    if (uniqueByConcept.length >= targetCount) {
      return uniqueByConcept;
    }
  }

  for (const problem of shuffle(allProblems)) {
    if (usedProblemIds.has(problem.id)) continue;
    uniqueByConcept.push(problem);
    usedProblemIds.add(problem.id);
    if (uniqueByConcept.length >= targetCount) break;
  }

  return uniqueByConcept;
}

function getPrimaryConcept(problem) {
  return (problem.concept_ids || [])[0] || "unknown_concept";
}

class AssessmentService {
  constructor() {
    this.sessions = new Map();
  }

  startAssessment({
    topicId,
    studentId,
    goals = [],
    availableHoursPerWeek = 6,
  }) {
    const kb = new KnowledgeBase(topicId);
    const conceptMap = buildConceptMap(kb);
    const questionQueue = pickAssessmentProblems(kb);
    const sessionId = randomUUID();
    const resolvedStudentId = studentId?.trim() || buildGuestStudentId(topicId);

    const coverage = questionQueue.map((problem, index) => {
      const primaryConcept = getPrimaryConcept(problem);
      return {
        order: index + 1,
        concept_id: primaryConcept,
        concept_label: conceptMap.get(primaryConcept)?.label || primaryConcept,
        problem_id: problem.id,
      };
    });

    const session = {
      sessionId,
      topicId,
      profile: {
        student_id: resolvedStudentId,
        subject: topicId,
        goals,
        available_hours_per_week: availableHoursPerWeek,
        confidence_by_concept: {},
        upcoming_deadlines: [],
      },
      kb,
      conceptMap,
      questionQueue,
      currentQuestionIndex: 0,
      attempts: [],
      conceptStats: {},
      conceptCoveragePlan: coverage,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    const firstProblem = questionQueue[0];
    const primaryConcept = getPrimaryConcept(firstProblem);
    return {
      session_id: sessionId,
      learner_profile: session.profile,
      concept_coverage_plan: coverage,
      progress: {
        answered: 0,
        total: questionQueue.length,
        remaining: questionQueue.length,
      },
      question: publicProblem(
        firstProblem,
        conceptMap.get(primaryConcept)?.label || primaryConcept
      ),
    };
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw Object.assign(
        new Error("Assessment session not found."),
        { status: 404 }
      );
    }
    return session;
  }

  submitAnswer({
    sessionId,
    problemId,
    selectedOption,
    timeSeconds = null,
  }) {
    const session = this.getSession(sessionId);
    if (session.status !== "active") {
      throw Object.assign(
        new Error("This assessment session is already complete."),
        { status: 409 }
      );
    }

    const currentProblem = session.questionQueue[session.currentQuestionIndex];
    if (!currentProblem || currentProblem.id !== problemId) {
      throw Object.assign(
        new Error("Please answer the current question shown in the session."),
        { status: 409 }
      );
    }

    const primaryConcept = getPrimaryConcept(currentProblem);
    const conceptLabel =
      session.conceptMap.get(primaryConcept)?.label || primaryConcept;
    const isCorrect = selectedOption === currentProblem.correct_option;

    const attempt = {
      problem_id: currentProblem.id,
      concept: primaryConcept,
      correct: isCorrect,
      error_tags: isCorrect ? [] : currentProblem.expected_error_tags || [],
      time_seconds: timeSeconds,
      hints_used: 0,
      retries: 0,
    };
    session.attempts.push(attempt);

    const stats = session.conceptStats[primaryConcept] || {
      correct: 0,
      total: 0,
    };
    stats.total += 1;
    if (isCorrect) {
      stats.correct += 1;
    }
    session.conceptStats[primaryConcept] = stats;
    session.profile.confidence_by_concept[primaryConcept] = scoreToConfidence(
      stats.correct,
      stats.total
    );

    session.currentQuestionIndex += 1;
    session.updatedAt = new Date().toISOString();

    const nextProblem = session.questionQueue[session.currentQuestionIndex] || null;
    if (!nextProblem) {
      session.status = "completed";
    }

    const weakestConcept = this.getWeakestConceptSummary(session);
    return {
      session_id: session.sessionId,
      correct: isCorrect,
      explanation: isCorrect
        ? `Nice work. This suggests you are reasonably comfortable with ${conceptLabel}.`
        : `Not quite. This question checks ${conceptLabel}, so I will use this miss to shape the next plan instead of just asking you to fill a form.`,
      updated_confidence: {
        concept_id: primaryConcept,
        concept_label: conceptLabel,
        confidence: session.profile.confidence_by_concept[primaryConcept],
      },
      progress: {
        answered: session.attempts.length,
        total: session.questionQueue.length,
        remaining: Math.max(session.questionQueue.length - session.attempts.length, 0),
      },
      next_question: nextProblem
        ? publicProblem(
            nextProblem,
            session.conceptMap.get(getPrimaryConcept(nextProblem))?.label ||
              getPrimaryConcept(nextProblem)
          )
        : null,
      assessment_complete: !nextProblem,
      assessment_summary: !nextProblem
        ? {
            attempted_questions: session.attempts.length,
            weakest_concept: weakestConcept.concept_id,
            weakest_concept_label: weakestConcept.concept_label,
            confidence_by_concept: session.profile.confidence_by_concept,
          }
        : null,
    };
  }

  getWeakestConceptSummary(session) {
    const confidenceEntries = Object.entries(session.profile.confidence_by_concept);
    if (!confidenceEntries.length) {
      const firstConcept = getPrimaryConcept(session.questionQueue[0] || {});
      return {
        concept_id: firstConcept,
        concept_label: session.conceptMap.get(firstConcept)?.label || firstConcept,
      };
    }

    const [conceptId] = confidenceEntries.sort((a, b) => a[1] - b[1])[0];
    return {
      concept_id: conceptId,
      concept_label: session.conceptMap.get(conceptId)?.label || conceptId,
    };
  }

  buildSnapshot(sessionId, overrides = {}) {
    const session = this.getSession(sessionId);
    if (session.attempts.length === 0) {
      throw Object.assign(
        new Error("Assessment must contain at least one answered question before planning."),
        { status: 409 }
      );
    }

    const profile = {
      ...session.profile,
      student_id: overrides.studentId || session.profile.student_id,
      goals: overrides.goals || session.profile.goals || [],
      available_hours_per_week:
        overrides.availableHoursPerWeek || session.profile.available_hours_per_week || 6,
      confidence_by_concept: {
        ...session.profile.confidence_by_concept,
      },
    };

    session.profile = profile;
    session.updatedAt = new Date().toISOString();

    return {
      profile,
      attempts: [...session.attempts],
      prior_interventions: [],
    };
  }
}

export const assessmentService = new AssessmentService();
