import React from "react";
import Card from "./Card";
import Banner from "./Banner";

export default function Step1ChooseTopic({
  studentId,
  setStudentId,
  topicId,
  setTopicId,
  topics,
  onStart,
  isLoading,
  message,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onStart();
  };

  return (
    <Card
      id="step1Card"
      step="1"
      title="Choose Topic & Start"
      description="Set up your student profile and select the concept topic pack you want to learn."
    >
      <form onSubmit={handleSubmit}>
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div className="form-group">
            <label htmlFor="studentIdInput">Student Name / ID</label>
            <input
              id="studentIdInput"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="subjectSelectInput">Topic Pack</label>
            <select
              id="subjectSelectInput"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              {topics.map((t) => (
                <option key={t.topic_id} value={t.topic_id}>
                  {t.title || t.topic_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="btn-row">
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Loading..." : "Start Baseline Assessment"}
          </button>
        </div>
      </form>

      {message.text && (
        <Banner text={message.text} type={message.type} className="step1-banner" />
      )}
    </Card>
  );
}
