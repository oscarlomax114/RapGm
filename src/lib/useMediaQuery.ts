"use client";
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    function onChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** true when viewport ≤ 640px */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 640px)");
}

/** true when viewport ≤ 1024px (mobile + tablet) */
export function useIsTabletOrBelow(): boolean {
  return useMediaQuery("(max-width: 1024px)");
}
