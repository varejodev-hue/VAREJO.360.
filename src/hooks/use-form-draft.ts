import { useEffect, useRef, useState } from "react";

const PREFIX = "draft:v1:";

export function useFormDraft<T extends Record<string, any>>(
  key: string | null,
  values: T,
  setValues: (v: T) => void,
) {
  const [restored, setRestored] = useState(false);
  const loadedRef = useRef(false);

  // Load once on mount
  useEffect(() => {
    if (!key || loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        setValues({ ...values, ...saved });
        setRestored(true);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Debounced save on change
  useEffect(() => {
    if (!key) return;
    const id = setTimeout(() => {
      try {
        const hasContent = Object.values(values).some(
          (v) => v !== "" && v !== null && v !== undefined && v !== false,
        );
        if (hasContent) localStorage.setItem(PREFIX + key, JSON.stringify(values));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [key, values]);

  function clearDraft() {
    if (!key) return;
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
    setRestored(false);
  }

  return { restored, clearDraft };
}
