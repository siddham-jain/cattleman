/**
 * What the model is doing, for the UI to show.
 *
 * The model is warmed in the background at startup and never blocks it, which
 * means there is a window where the app looks ready but cannot identify
 * anything. On a phone that window is a few hundred milliseconds. In a browser
 * on a field connection it is closer to half a minute of fetching 30 MB, and
 * without this the only thing the worker sees is a spinner that does not move.
 *
 * Phases: idle -> runtime -> downloading -> preparing -> ready, or error.
 * `downloading` is web-only; the phone has the graph in its bundle.
 */
import { useEffect, useState } from 'react';

const listeners = new Set();

let status = { phase: 'idle', progress: 0, error: null };

export function getModelStatus() {
  return status;
}

export function setModelStatus(next) {
  status = { ...status, ...next };
  listeners.forEach((listener) => listener(status));
}

export function useModelStatus() {
  const [current, setCurrent] = useState(status);
  useEffect(() => {
    // Re-read on mount: loading starts at app startup and may already have
    // moved on before this screen rendered.
    setCurrent(status);
    listeners.add(setCurrent);
    return () => listeners.delete(setCurrent);
  }, []);
  return current;
}
