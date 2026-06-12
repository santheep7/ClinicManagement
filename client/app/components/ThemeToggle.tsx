"use client";

import { useEffect, useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "hospital-theme";

type ThemeMode = "light" | "dark";

function getSavedTheme(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
}

function subscribeToThemeChanges(callback: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", handleStorage);
  mediaQuery.addEventListener("change", callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    mediaQuery.removeEventListener("change", callback);
  };
}

function getServerTheme(): ThemeMode {
  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToThemeChanges, getSavedTheme, getServerTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: nextTheme }));
  }

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="theme-toggle-btn"
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 5.05l-1.414-1.414M7.464 7.464L6.05 6.05m12.9 0-1.414 1.414M7.464 16.536l-1.414 1.414" />
          <circle cx="12" cy="12" r="5" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
      <span className="sr-only">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
