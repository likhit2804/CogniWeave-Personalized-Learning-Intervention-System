import React from "react";

export default function Banner({ text, type = "info", id, className = "", children }) {
  if (!text && !children) return null;
  return (
    <div id={id} className={`message-banner ${type} ${className}`}>
      {text || children}
    </div>
  );
}
