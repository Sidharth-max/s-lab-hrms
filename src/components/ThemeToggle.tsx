"use client";

import { Moon, Sun } from "./icons";

/** Light / dark switch. The choice is saved in this browser; without a choice the device setting is used. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`btn-secondary !h-8 !w-8 !px-0 ${className}`}
      aria-label="Switch between light and dark mode"
      title="Light / dark mode"
      onClick={() => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("hrms.theme", next);
        } catch {}
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0a0a0a" : "#ffffff");
      }}
    >
      {/* The icon follows the theme through CSS, so it is right before any script runs. */}
      <Moon size={15} aria-hidden className="dark:hidden" />
      <Sun size={15} aria-hidden className="hidden dark:block" />
    </button>
  );
}
