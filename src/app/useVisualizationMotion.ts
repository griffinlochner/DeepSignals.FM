import { useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useVisualizationMotion(initialOverride: boolean | null = null) {
  const systemReducedMotion = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );
  const [motionOverride, setMotionEnabled] = useState(initialOverride);

  return {
    motionEnabled: motionOverride ?? !systemReducedMotion,
    motionOverride,
    setMotionEnabled,
  };
}
