import { useEffect } from "react";

/**
 * While `dirty`, leaving the page - a link, a reload, closing the tab - asks
 * first, with the browser's own "Leave site?" prompt (no page can set its
 * words). The outfit editor and the Character tabs use it: each saves with
 * one button, and a plain link away would otherwise drop what was typed.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers prompt only when returnValue is set, not for preventDefault().
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);
}
