import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHelpMode } from "../context/HelpModeContext";

interface HelpHintProps {
  /** Plain-language explanation of what the page/section does. */
  children: ReactNode;
  className?: string;
}

/**
 * Small blue inline help text shown only while help mode is enabled
 * (toggled from the top bar). Renders nothing when help mode is off so the
 * UI stays uncluttered for experienced users.
 */
export function HelpHint({ children, className }: HelpHintProps) {
  const { enabled } = useHelpMode();
  if (!enabled) return null;
  return (
    <p
      role="note"
      className={cn(
        "mt-1 flex items-start gap-1 text-xs leading-snug text-blue-600 dark:text-blue-400",
        className,
      )}
    >
      <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
