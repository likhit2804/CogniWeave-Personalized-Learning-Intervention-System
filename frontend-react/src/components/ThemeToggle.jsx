import React from "react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="theme-switch-btn" onClick={toggleTheme} type="button">
      {theme === "light" ? "Dark Mode" : "Light Mode"}
    </button>
  );
}
