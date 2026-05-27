import React, { useState, useEffect } from "react";
import Card from "./Card";
import Banner from "./Banner";
import ProblemLinkBanner from "./ProblemLinkBanner";
import IssueList from "./IssueList";

export default function Step4Checkpoint({
  checkpointProblem,
  topicId,
  onSubmitCheckpoint,
  onRestart,
  isLoading,
  message,
}) {
  const [successChecked, setSuccessChecked] = useState(true);
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [description, setDescription] = useState("");
  const [selectedMcqOption, setSelectedMcqOption] = useState("");

  // Reset inputs when problem changes
  useEffect(() => {
    setSuccessChecked(true);
    setSelectedIssues([]);
    setDescription("");
    setSelectedMcqOption("");
  }, [checkpointProblem]);

  if (!checkpointProblem) return null;

  const matchLink = checkpointProblem.question_text?.match(/https?:\/\/[^\s\)]+/);
  const isExternalLink = matchLink !== null || topicId === "dsa_comprehensive";

  const handleIssueToggle = (issueId) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isExternalLink) {
      const selectedOption = successChecked ? checkpointProblem.correct_option : "C";
      onSubmitCheckpoint({
        selected_option: selectedOption,
        reported_issues: successChecked ? [] : selectedIssues,
        description: description,
      });
    } else {
      if (!selectedMcqOption) return;
      onSubmitCheckpoint({
        selected_option: selectedMcqOption,
        reported_issues: [],
        description: "",
      });
    }
  };

  const isSubmitDisabled = isLoading || (!isExternalLink && !selectedMcqOption);

  return (
    <Card
      id="step4Card"
      step="4"
      title="Checkpoint Practice"
      description={
        isExternalLink
          ? "Solve this checkpoint problem matching your weakest concept to verify if you have achieved mastery."
          : "Answer this checkpoint question directly inside the portal to verify if you have achieved mastery."
      }
    >
      <div className="report-section" id="checkpointReportBox">
        <div className="report-meta">
          <span>{checkpointProblem.title}</span>
          <span style={{ textTransform: "uppercase" }}>{checkpointProblem.difficulty || "medium"}</span>
        </div>

        {isExternalLink ? (
          <div id="checkpointSelfReportContainer">
            <ProblemLinkBanner
              title={checkpointProblem.title}
              questionText={checkpointProblem.question_text}
              solveBtnId="solveOnLeetcodeBtn2"
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
              <div id="checkpointIssuesContainer">
                <div className="form-group">
                  <label>Select any issue(s) you faced:</label>
                  <IssueList
                    namePrefix="checkpoint"
                    selectedIssues={selectedIssues}
                    onIssueToggle={handleIssueToggle}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="checkpointDescription">Mistake / Stuck Description</label>
                  <textarea
                    id="checkpointDescription"
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
            <div className="question-text-classic">{checkpointProblem.question_text}</div>

            <div className="form-group">
              <label>Select your answer:</label>
              <div className="options-list" style={{ marginTop: "8px" }}>
                {Object.entries(checkpointProblem.options || {}).map(([key, val]) => (
                  <div
                    key={key}
                    className={`option-item ${selectedMcqOption === key ? "selected" : ""}`}
                    onClick={() => setSelectedMcqOption(key)}
                  >
                    <input
                      type="radio"
                      name="checkpointMcqRadio"
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
            {isLoading ? "Evaluating..." : "Submit Practice Outcome"}
          </button>
          <button className="secondary" onClick={onRestart} type="button">
            Restart Journey
          </button>
        </div>
      </div>

      {message.text && (
        <Banner text={message.text} type={message.type} className="checkpoint-banner" />
      )}
    </Card>
  );
}
