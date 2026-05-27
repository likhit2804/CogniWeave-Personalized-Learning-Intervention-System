import React from "react";
import Card from "./Card";

export default function Step3StudyPlan({ planData, onContinue }) {
  if (!planData) return null;

  const conceptName = planData.diagnosis?.weakest_concept
    ? planData.diagnosis.weakest_concept.replace(/_/g, " ").toUpperCase()
    : "UNKNOWN CONCEPT";
  const reasoning = planData.diagnosis?.reasoning || planData.selected_intervention?.why || "";
  const misconception = planData.diagnosis?.misconception_label
    ? `Diagnosed Misconception: ${planData.diagnosis.misconception_label}`
    : "";

  const bottlenecks = planData.retrieval_context?.prerequisite_bottlenecks || [];
  const activities = planData.selected_intervention?.activities || [];
  const schedule = planData.weekly_plan || [];

  return (
    <Card
      id="step3Card"
      step="3"
      title="Personalized Learning Plan"
      description="We diagnosed your misconceptions. Here is your target study focus and actionable activities."
    >
      <div className="plan-layout">
        <div className="plan-section">
          <h3>Focus Diagnosis</h3>
          <div className="plan-detail-card">
            <div className="plan-highlight">{conceptName}</div>
            <div className="plan-summary-text">{reasoning}</div>
            {misconception && <div className="plan-summary-text" style={{ marginBottom: 0 }}>{misconception}</div>}
          </div>
        </div>

        <div className="plan-section">
          <h3>Prerequisite Bottlenecks Found</h3>
          <div className="plan-detail-card" style={{ borderLeft: "4px solid var(--accent)" }}>
            {bottlenecks.length > 0 ? (
              <div className="plan-summary-text" style={{ fontWeight: 500, marginBottom: 0 }}>
                {bottlenecks.map((b, idx) => (
                  <div key={idx}>
                    Concept <strong>{b.bottleneck.replace(/_/g, " ")}</strong> is a blocking prerequisite bottleneck for <strong>{b.blocked.replace(/_/g, " ")}</strong>.
                  </div>
                ))}
              </div>
            ) : (
              <div className="plan-summary-text" style={{ fontWeight: 500, marginBottom: 0 }}>
                No prerequisite blockers in graph for current focus.
              </div>
            )}
          </div>
        </div>

        {activities.length > 0 && (
          <div className="plan-section">
            <h3>Target Activities</h3>
            <div className="plan-detail-card">
              <ul className="plan-list">
                {activities.map((act, idx) => (
                  <li key={idx} className="plan-list-item">
                    {act}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {schedule.length > 0 && (
          <div className="plan-section">
            <h3>Weekly Study Schedule</h3>
            <div className="schedule-grid">
              {schedule.map((item, idx) => (
                <div key={idx} className="schedule-card">
                  <div className="schedule-day">{item.day}</div>
                  <div className="schedule-title">{item.focus}</div>
                  <div className="schedule-meta">
                    {item.activity_type} • {item.minutes} mins
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: "24px" }}>
        <button onClick={onContinue} type="button">
          Continue to Practice Checkpoint
        </button>
      </div>
    </Card>
  );
}
