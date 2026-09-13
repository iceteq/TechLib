import { useCallback, useEffect, useRef, useState } from 'react';

/** One-shot CSS animation trigger (restarts cleanly on repeated clicks). */
export function useJuiceBurst(durationMs = 300) {
  const [bursting, setBursting] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const trigger = useCallback(() => {
    clear();
    setBursting(false);
    requestAnimationFrame(() => {
      setBursting(true);
      timerRef.current = window.setTimeout(() => {
        setBursting(false);
        timerRef.current = null;
      }, durationMs);
    });
  }, [clear, durationMs]);

  return { bursting, trigger };
}
