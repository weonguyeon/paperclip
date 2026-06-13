import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface HelpModeContextValue {
  /** When true, inline <HelpHint> explanations are visible across the app. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

const HELP_MODE_STORAGE_KEY = "paperclip.helpMode";
const HelpModeContext = createContext<HelpModeContextValue | undefined>(undefined);

function readInitialHelpMode(): boolean {
  // Default OFF so the UI stays clean until the user opts into help text.
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(HELP_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function HelpModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => readInitialHelpMode());

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((current) => !current);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HELP_MODE_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [enabled]);

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      toggle,
    }),
    [enabled, setEnabled, toggle],
  );

  return (
    <HelpModeContext.Provider value={value}>
      {children}
    </HelpModeContext.Provider>
  );
}

export function useHelpMode() {
  const context = useContext(HelpModeContext);
  if (!context) {
    throw new Error("useHelpMode must be used within HelpModeProvider");
  }
  return context;
}
