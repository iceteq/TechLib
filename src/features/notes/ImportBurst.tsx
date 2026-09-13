import { useEffect, useMemo, useRef } from 'react';
import styles from './ImportBurst.module.css';

interface ImportBurstProps {
  /** Number of notes imported — drives particle count and label. */
  count: number;
  /** Change to retrigger the burst for a new import. */
  burstKey: number;
  onDone: () => void;
}

/** Subtle bottom-center celebration after a successful paste import. */
export function ImportBurst({ count, burstKey, onDone }: ImportBurstProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const particles = useMemo(() => {
    const n = Math.min(14, Math.max(6, Math.round(4 + count * 0.35)));
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = (t - 0.5) * 160;
      const drift = (i % 2 === 0 ? -1 : 1) * (8 + (i % 5) * 4);
      const delay = (i % 7) * 28;
      const size = 4 + (i % 3);
      return { id: i, x, drift, delay, size };
    });
  }, [count, burstKey]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => onDoneRef.current(), reduce ? 700 : 1100);
    return () => window.clearTimeout(timer);
  }, [burstKey]);

  if (count <= 0) return null;

  return (
    <div className={styles.root} aria-hidden>
      <div className={styles.stage}>
        {particles.map((p) => (
          <span
            key={`${burstKey}-${p.id}`}
            className={styles.particle}
            style={{
              ['--x' as string]: `${p.x}px`,
              ['--drift' as string]: `${p.drift}px`,
              ['--delay' as string]: `${p.delay}ms`,
              ['--size' as string]: `${p.size}px`,
            }}
          />
        ))}
        <p className={styles.summary}>
          {count} note{count === 1 ? '' : 's'} added
        </p>
      </div>
    </div>
  );
}
