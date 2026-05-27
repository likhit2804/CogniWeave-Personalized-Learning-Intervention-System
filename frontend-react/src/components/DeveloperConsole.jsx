import React from "react";

export default function DeveloperConsole({ payload }) {
  return (
    <details className="dev-console">
      <summary>Developer Console Logs & State</summary>
      <div>
        <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "8px" }}>
          View active state output from CogniWeave agents:
        </p>
        <pre className="dev-json">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </details>
  );
}
