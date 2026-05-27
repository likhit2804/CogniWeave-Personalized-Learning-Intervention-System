import React from "react";

export const COMMON_ISSUES = [
  { id: "incorrect_map_lookup", label: "Lookup Key Error", desc: "Student checks index instead of value, or uses bad keys inside hash maps." },
  { id: "wrong_pointer_increment", label: "Pointer Move Error", desc: "Incrementing right pointer instead of decrementing, or missing edge increments." },
  { id: "out_of_bounds_window", label: "Off-by-One Window Bounds", desc: "Window sizes calculated as right - left, or failing to shrink boundaries dynamically." },
  { id: "null_pointer_exception", label: "Null Pointer Dereference", desc: "Accessing next pointer of a null node, causing reference error / crash." },
  { id: "fast_slow_step_mismatch", label: "Fast/Slow Pointer Step Error", desc: "Fast pointer moves at wrong speed or doesn't check step ahead boundary." },
  { id: "infinite_recursion", label: "Missing Recursion Base Case", desc: "Recursion runs infinitely, hitting Call Stack Size Exceeded / Stack Overflow." },
  { id: "traversal_order_mismatch", label: "Incorrect Traversal Order", desc: "Pre-order instead of post-order node processing, leading to wrong sums." },
  { id: "cycle_stuck_forever", label: "Missing Visited Tracker", desc: "Graph traversal gets stuck in infinite cycle loops because no visited set is used." },
  { id: "missing_backtrack_step", label: "Forgetting to Undo Decisions", desc: "Backtracking candidate was pushed, but not popped after recursion returned." },
  { id: "dependency_cycle_unhandled", label: "Cyclic Dependency Sort failure", desc: "Topological sorting runs into cycle, returning deadlocks." }
];

export default function IssueList({ namePrefix, selectedIssues, onIssueToggle }) {
  return (
    <div className="issues-grid">
      {COMMON_ISSUES.map((issue) => {
        const isChecked = selectedIssues.includes(issue.id);
        return (
          <label key={issue.id} className="issue-checkbox">
            <input
              type="checkbox"
              name={`${namePrefix}Issues`}
              value={issue.id}
              checked={isChecked}
              onChange={() => onIssueToggle(issue.id)}
            />
            <div>
              <div className="issue-label-text">{issue.label}</div>
              <div className="issue-desc">{issue.desc}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
