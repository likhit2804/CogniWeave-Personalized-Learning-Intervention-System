import React, { useState, useEffect } from "react";
import Card from "./Card";
import Banner from "./Banner";
import ProblemLinkBanner from "./ProblemLinkBanner";
import IssueList from "./IssueList";

export default function Step2BaselineCheck({
  question,
  progress,
  topicId,
  onSubmitAnswer,
  isLoading,
  message,
}) {
  const [successChecked, setSuccessChecked] = useState(true);
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [description, setDescription] = useState("");
  const [selectedMcqOption, setSelectedMcqOption] = useState("");

  // Reset inputs when question changes
  useEffect(() => {
    setSuccessChecked(true);
    setSelectedIssues([]);
    setDescription("");
    setSelectedMcqOption("");
  }, [question]);

  if (!question) return null;

  // Determine if it is external-link or dsa comprehensive
  const matchLink = question.question_text?.match(/https?:\/\/[^\s\)]+/);
  const isExternalLink = matchLink !== null || topicId === "dsa_comprehensive";

  const handleIssueToggle = (issueId) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isExternalLink) {
      const selectedOption = successChecked ? "A" : "C";
      onSubmitAnswer({
        selected_option: selectedOption,
        reported_issues: successChecked ? [] : selectedIssues,
        description: description,
      });
    } else {
      if (!selectedMcqOption) return;
      onSubmitAnswer({
        selected_option: selectedMcqOption,
        reported_issues: [],
        description: "",
      });
    }
  };

  const isSubmitDisabled = isLoading || (!isExternalLink && !selectedMcqOption);

  return (
    <Card
      id="step2Card"
      step="2"
      title="Diagnostic Baseline Check"
      description={
        isExternalLink
          ? "Solve this problem on LeetCode, then report your progress and any issues faced."
          : "Answer the question directly inside the portal."
      }
    >
      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
        Question {progress?.answered + 1} of {progress?.total}
      </div>

      <div className="report-section" id="assessmentReportBox">
        <div className="report-meta">
          <span>{question.concept_label || "Topic Baseline"}</span>
          <span style={{ textTransform: "uppercase" }}>{question.difficulty || "medium"}</span>
        </div>

        {isExternalLink ? (
          <div id="assessmentSelfReportContainer">
            <ProblemLinkBanner
              title={question.title}
              questionText={question.question_text}
              solveBtnId="solveOnLeetcodeBtn1"
            />

            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={successChecked}
                onChange={(e) => setSuccessChecked(e.target.checked)}
              />
              <span>I solved the problem successfully (Optimal / Sub-optimal)</span>
            </label>

            {!successChecked && (
              <div id="assessmentIssuesContainer">
                <div className="form-group">
                  <label>Select any issue(s) you faced:</label>
                  <IssueList
                    namePrefix="baseline"
                    selectedIssues={selectedIssues}
                    onIssueToggle={handleIssueToggle}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="assessmentDescription">Mistake / Stuck Description</label>
                  <textarea
                    id="assessmentDescription"
                    placeholder="Briefly describe what went wrong or why you got stuck..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="question-text-classic">{question.question_text}</div>

            <div className="form-group">
              <label>Select your answer:</label>
              <div className="options-list" style={{ marginTop: "8px" }}>
                {Object.entries(question.options || {}).map(([key, val]) => (
                  <div
                    key={key}
                    className={`option-item ${selectedMcqOption === key ? "selected" : ""}`}
                    onClick={() => setSelectedMcqOption(key)}
                  >
                    <input
                      type="radio"
                      name="baselineMcqRadio"
                      value={key}
                      checked={selectedMcqOption === key}
                      onChange={() => setSelectedMcqOption(key)}
                    />
                    <div className="option-item-content">
                      <span className="option-letter">{key}:</span> {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: "20px" }}>
          <button onClick={handleSubmit} disabled={isSubmitDisabled} type="button">
            {isLoading ? "Submitting..." : "Submit Answer"}
          </button>
        </div>
      </div>

      {message.text && (
        <Banner text={message.text} type={message.type} className="assessment-banner" />
      )}
    </Card>
  );
}
