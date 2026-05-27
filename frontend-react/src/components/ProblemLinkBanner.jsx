import React from "react";

export default function ProblemLinkBanner({ title, questionText, solveBtnId }) {
  const matchLink = questionText?.match(/https?:\/\/[^\s\)]+/);
  const leetcodeLink = matchLink ? matchLink[0] : "https://leetcode.com/problemset/";
  const isLeetcode = leetcodeLink.includes("leetcode.com");

  const handleOpenLink = () => {
    window.open(leetcodeLink, "_blank");
  };

  return (
    <div className="problem-link-banner">
      <div>
        <h4>{title || "Loading Problem..."}</h4>
        <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "4px" }}>
          Click the button to solve directly on LeetCode
        </p>
      </div>
      <button
        className="secondary"
        id={solveBtnId}
        onClick={handleOpenLink}
        type="button"
        style={{ padding: "8px 16px", fontSize: "0.85rem" }}
      >
        {isLeetcode ? "Solve on LeetCode" : "Open Practice Link"}
      </button>
    </div>
  );
}
