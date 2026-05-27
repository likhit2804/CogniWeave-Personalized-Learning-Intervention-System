import React, { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import Banner from "./components/Banner";
import Step1ChooseTopic from "./components/Step1ChooseTopic";
import Step2BaselineCheck from "./components/Step2BaselineCheck";
import Step3StudyPlan from "./components/Step3StudyPlan";
import Step4Checkpoint from "./components/Step4Checkpoint";
import DeveloperConsole from "./components/DeveloperConsole";

const BACKEND_URL = "http://localhost:8000";

function AppContent() {
  const { theme } = useTheme();
  const [backendOnline, setBackendOnline] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Checking Backend...");
  
  // App States
  const [sessionId, setSessionId] = useState(null);
  const [studentId, setStudentId] = useState("student_johndoe");
  const [topicId, setTopicId] = useState("dsa_comprehensive");
  const [topics, setTopics] = useState([]);
  const [activeCardId, setActiveCardId] = useState("step1Card");
  const [isLoading, setIsLoading] = useState(false);

  // Step 2 Diagnostic states
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionProgress, setCurrentQuestionProgress] = useState(null);

  // Step 3 Plan states
  const [planData, setPlanData] = useState(null);
  const [weakestConceptId, setWeakestConceptId] = useState("");

  // Step 4 Checkpoint states
  const [checkpointProblem, setCheckpointProblem] = useState(null);

  // Message Banners
  const [step1Message, setStep1Message] = useState({ text: "", type: "info" });
  const [assessmentMessage, setAssessmentMessage] = useState({ text: "", type: "info" });
  const [checkpointMessage, setCheckpointMessage] = useState({ text: "", type: "info" });

  const isLiveServer = window.location.port === "5500" || window.location.port === "5501";

  // Build full payload for Developer console logs
  const devState = {
    backendOnline,
    sessionId,
    studentId,
    topicId,
    currentQuestion,
    currentQuestionProgress,
    weakestConceptId,
    checkpointProblem,
    topics,
    activeCardId,
    planData,
  };

  // 1. Health check & Fetch topics on load
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        if (res.ok) {
          setBackendOnline(true);
          setBackendStatus("Backend Connected");
          await fetchTopics();
        } else {
          throw new Error();
        }
      } catch (err) {
        setBackendOnline(false);
        setBackendStatus("Backend Offline");
        setStep1Message({
          text: `Cannot connect to Node backend at ${BACKEND_URL}`,
          type: "error",
        });
      }
    }
    checkBackend();
  }, []);

  // 2. Load cached state from LocalStorage after backend connection is verified
  useEffect(() => {
    if (!backendOnline) return;
    try {
      const raw = localStorage.getItem("cogniweave_state");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved) {
          if (saved.sessionId) setSessionId(saved.sessionId);
          if (saved.studentId) setStudentId(saved.studentId);
          if (saved.topicId) setTopicId(saved.topicId);
          if (saved.currentQuestion) setCurrentQuestion(saved.currentQuestion);
          if (saved.currentQuestionProgress) setCurrentQuestionProgress(saved.currentQuestionProgress);
          if (saved.weakestConceptId) setWeakestConceptId(saved.weakestConceptId);
          if (saved.checkpointProblem) setCheckpointProblem(saved.checkpointProblem);
          if (saved.activeCardId) setActiveCardId(saved.activeCardId);
          if (saved.planData) setPlanData(saved.planData);
        }
      }
    } catch (e) {
      console.warn("Failed to restore state:", e);
    }
  }, [backendOnline]);

  // 3. Cache state to LocalStorage when states change
  useEffect(() => {
    if (!backendOnline) return;
    try {
      localStorage.setItem(
        "cogniweave_state",
        JSON.stringify({
          sessionId,
          studentId,
          topicId,
          currentQuestion,
          currentQuestionProgress,
          weakestConceptId,
          checkpointProblem,
          activeCardId,
          planData,
        })
      );
    } catch (e) {
      console.warn("Storage write blocked:", e);
    }
  }, [
    sessionId,
    studentId,
    topicId,
    currentQuestion,
    currentQuestionProgress,
    weakestConceptId,
    checkpointProblem,
    activeCardId,
    planData,
    backendOnline,
  ]);

  const fetchTopics = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/ingest/topics`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
        if (data && data.length > 0) {
          // If current topicId is not in fetched topics, default to first topic
          const hasTopic = data.some((t) => t.topic_id === topicId);
          if (!hasTopic) {
            setTopicId(data[0].topic_id);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch topics:", err);
    }
  };

  // Step 1 action: Start Baseline assessment
  const startAssessment = async () => {
    if (!backendOnline) {
      setStep1Message({ text: "Backend must be online to start.", type: "error" });
      return;
    }

    setIsLoading(true);
    setStep1Message({ text: "", type: "info" });

    try {
      const res = await fetch(`${BACKEND_URL}/assessment/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topicId,
          student_id: studentId,
          goals: ["Solve adaptive study problems optimally"],
          available_hours_per_week: 6,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start assessment");

      setSessionId(data.session_id);
      setCurrentQuestion(data.question);
      setCurrentQuestionProgress(data.progress);
      setPlanData(null);
      setWeakestConceptId("");
      setCheckpointProblem(null);
      setAssessmentMessage({ text: "", type: "info" });

      setActiveCardId("step2Card");
    } catch (err) {
      setStep1Message({ text: err.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 action: Submit Assessment Answer
  const submitAssessmentAnswer = async (payload) => {
    setIsLoading(true);
    setAssessmentMessage({ text: "Submitting...", type: "info" });

    try {
      const res = await fetch(`${BACKEND_URL}/assessment/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          problem_id: currentQuestion.id,
          selected_option: payload.selected_option,
          reported_issues: payload.reported_issues,
          description: payload.description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Submission failed");

      setAssessmentMessage({
        text: data.explanation,
        type: data.correct ? "success" : "info",
      });

      setTimeout(() => {
        setAssessmentMessage({ text: "", type: "info" });
        if (data.assessment_complete) {
          generateLearningPlan();
        } else {
          setCurrentQuestion(data.next_question);
          setCurrentQuestionProgress(data.progress);
        }
      }, 2200);
    } catch (err) {
      setAssessmentMessage({ text: err.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 -> 3 transition: Generate Plan
  const generateLearningPlan = async () => {
    setAssessmentMessage({
      text: "Analyzing baseline responses and building learning path...",
      type: "info",
    });

    try {
      const res = await fetch(`${BACKEND_URL}/assessment/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          goals: ["Solve adaptive study problems optimally"],
          available_hours_per_week: 6,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Planning failed");

      setPlanData(data);
      setWeakestConceptId(data.diagnosis.weakest_concept);
      setActiveCardId("step3Card");
    } catch (err) {
      setAssessmentMessage({ text: err.message, type: "error" });
    }
  };

  // Step 3 transition: Continue to Practice Checkpoint
  const handleContinueToPractice = () => {
    setActiveCardId("step4Card");
    loadCheckpointProblem();
  };

  const loadCheckpointProblem = async () => {
    setCheckpointMessage({ text: "", type: "info" });
    try {
      const res = await fetch(
        `${BACKEND_URL}/evaluation/problems/${topicId}/${weakestConceptId}?student_id=${studentId}`
      );
      if (!res.ok) throw new Error("Could not find practice problem");

      const data = await res.json();
      setCheckpointProblem(data);
    } catch (err) {
      setCheckpointMessage({ text: err.message, type: "error" });
    }
  };

  // Step 4 action: Submit Practice Outcome
  const submitCheckpointOutcome = async (payload) => {
    if (!checkpointProblem) return;

    setIsLoading(true);
    setCheckpointMessage({ text: "Evaluating...", type: "info" });

    try {
      const res = await fetch(`${BACKEND_URL}/evaluation/evaluate?topic_id=${topicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          problem_id: checkpointProblem.id,
          selected_option: payload.selected_option,
          reported_issues: payload.reported_issues,
          description: payload.description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Checkpoint evaluation failed");

      if (data.mastery_achieved) {
        setCheckpointMessage({ text: `Success! ${data.feedback}`, type: "success" });
      } else if (data.replan_required) {
        setCheckpointMessage({
          text: `Replan Triggered: ${data.feedback}. We will adapt your learning plan.`,
          type: "error",
        });
      } else {
        setCheckpointMessage({ text: data.feedback, type: "info" });
      }
    } catch (err) {
      setCheckpointMessage({ text: err.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const restartJourney = () => {
    setSessionId(null);
    setCurrentQuestion(null);
    setCurrentQuestionProgress(null);
    setWeakestConceptId("");
    setCheckpointProblem(null);
    setPlanData(null);
    setStep1Message({ text: "", type: "info" });
    setAssessmentMessage({ text: "", type: "info" });
    setCheckpointMessage({ text: "", type: "info" });
    setStudentId(`student_${Math.random().toString(36).substring(2, 7)}`);
    setActiveCardId("step1Card");
    try {
      localStorage.removeItem("cogniweave_state");
    } catch (e) {}
  };

  return (
    <>
      {/* Background outline shapes */}
      <div className="bg-shapes">
        <svg className="bg-shape shape-1" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.25" />
          <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.15" strokeDasharray="2 2" />
        </svg>
        <svg className="bg-shape shape-2" viewBox="0 0 100 100" fill="none">
          <rect x="2" y="2" width="96" height="96" rx="10" stroke="currentColor" strokeWidth="0.25" />
          <path d="M10 0 L10 100 M20 0 L20 100 M30 0 L30 100 M40 0 L40 100 M50 0 L50 100 M60 0 L60 100 M70 0 L70 100 M80 0 L80 100 M90 0 L90 100" stroke="currentColor" strokeWidth="0.05" />
        </svg>
        <svg className="bg-shape shape-3" viewBox="0 0 100 100" fill="none">
          <polygon points="50,2 98,85 2,85" stroke="currentColor" strokeWidth="0.25" />
        </svg>
      </div>

      <div className="container">
        {isLiveServer && (
          <Banner type="error" className="live-server-warning" style={{ marginBottom: "20px" }}>
            Warning: You are viewing this page via a VS Code Live Server port. To prevent database writes from triggering automatic browser reloads, please use the official Node server address:{" "}
            <a href="http://localhost:8000" style={{ color: "inherit", fontWeight: 700 }}>
              http://localhost:8000
            </a>.
          </Banner>
        )}

        <header>
          <h1>CogniWeave Portal</h1>
          <p>Your AI-guided adaptive learning assistant</p>
          <div className={`connection-badge ${backendOnline ? "online" : "offline"}`}>
            <span className="dot"></span>
            <span>{backendStatus}</span>
          </div>
          <ThemeToggle />
        </header>

        {activeCardId === "step1Card" && (
          <Step1ChooseTopic
            studentId={studentId}
            setStudentId={setStudentId}
            topicId={topicId}
            setTopicId={setTopicId}
            topics={topics}
            onStart={startAssessment}
            isLoading={isLoading}
            message={step1Message}
          />
        )}

        {activeCardId === "step2Card" && (
          <Step2BaselineCheck
            question={currentQuestion}
            progress={currentQuestionProgress}
            topicId={topicId}
            onSubmitAnswer={submitAssessmentAnswer}
            isLoading={isLoading}
            message={assessmentMessage}
          />
        )}

        {activeCardId === "step3Card" && (
          <Step3StudyPlan
            planData={planData}
            onContinue={handleContinueToPractice}
          />
        )}

        {activeCardId === "step4Card" && (
          <Step4Checkpoint
            checkpointProblem={checkpointProblem}
            topicId={topicId}
            onSubmitCheckpoint={submitCheckpointOutcome}
            onRestart={restartJourney}
            isLoading={isLoading}
            message={checkpointMessage}
          />
        )}

        <DeveloperConsole payload={devState} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
