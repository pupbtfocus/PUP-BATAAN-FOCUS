"use client";

import { useEffect } from "react";

/**
 * Adds the `campus-bg` class to the <body> element on mount,
 * enabling the campus photo background defined in globals.css.
 * Removes it on unmount so dashboard routes stay clean.
 */
export function CampusBackground() {
  useEffect(() => {
    document.body.classList.add("campus-bg");
    return () => {
      document.body.classList.remove("campus-bg");
    };
  }, []);

  return null;
}
