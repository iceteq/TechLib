import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { ViewPrefs } from '../../lib/viewPrefs';
import styles from './ViewOptionsMenu.module.css';

const OPTIONS: { key: keyof ViewPrefs; label: string }[] = [
  { key: 'barcodes', label: 'Barcodes' },
  { key: 'photos', label: 'Photos' },
  { key: 'description', label: 'Description' },
  { key: 'specialCase', label: 'Special note' },
  { key: 'typeChip', label: 'Type chip' },
  { key: 'labels', label: 'Labels' },
  { key: 'age', label: 'Relative time' },
];

interface ViewOptionsMenuProps {
  prefs: ViewPrefs;
  onChange: (prefs: ViewPrefs) => void;
}

export function ViewOptionsMenu({ prefs, onChange }: ViewOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggle(key: keyof ViewPrefs) {
    onChange({ ...prefs, [key]: !prefs[key] });
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="View options"
        title="View options"
      >
        <SlidersHorizontal size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="View options">
          <p className={styles.menuTitle}>Show on cards</p>
          {OPTIONS.map((option) => (
            <label key={option.key} className={styles.item} role="menuitemcheckbox">
              <input
                type="checkbox"
                checked={prefs[option.key]}
                onChange={() => toggle(option.key)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
