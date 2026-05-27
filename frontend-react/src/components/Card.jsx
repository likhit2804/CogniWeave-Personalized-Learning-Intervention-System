import React from "react";

export default function Card({ id, step, title, description, children, className = "" }) {
  return (
    <section className={`card ${className}`} id={id}>
      <h2>
        {step && <span className="step-num">{step}</span>}
        {title}
      </h2>
      {description && <p className="card-description">{description}</p>}
      {children}
    </section>
  );
}
