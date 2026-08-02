/**
 * Recording mode — hides all site chrome for clean screen captures.
 * Toggle with the H key, or load any page with ?recording=1.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const RecordingContext = createContext(false);

export function useRecordingMode() {
  return useContext(RecordingContext);
}

function queryRequestsRecordingMode() {
  return new URLSearchParams(window.location.search).get("recording") === "1";
}

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(queryRequestsRecordingMode);

  const setRecordingMode = useCallback((next: boolean) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("recording", "1");
    else url.searchParams.delete("recording");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
    setHidden(next);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches(
        "input, textarea, select, [contenteditable='true']"
      );
      if (!isTyping && event.key.toLowerCase() === "h") {
        setRecordingMode(!hidden);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hidden, setRecordingMode]);

  return (
    <RecordingContext.Provider value={hidden}>
      {children}
    </RecordingContext.Provider>
  );
}
