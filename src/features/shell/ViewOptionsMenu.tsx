import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { ViewPrefs, WallGroupBy, WallSort } from '../../lib/viewPrefs';
import styles from './ViewOptionsMenu.module.css';

const SHOW_OPTIONS: {
  key: Exclude<keyof ViewPrefs, 'sort' | 'groupBy'>;
  label: string;
  shortcut?: string;
}[] = [
  { key: 'barcodes', label: 'Barcodes', shortcut: 'B' },
  { key: 'photos', label: 'Photos' },
  { key: 'description', label: 'Description' },
  { key: 'specialCase', label: 'Special note' },
  { key: 'typeChip', label: 'Type chip' },
  { key: 'labels', label: 'Labels' },
  { key: 'age', label: 'Relative time' },
];

const SORT_OPTIONS: { value: WallSort; label: string; hint: string }[] = [
  { value: 'default', label: 'Recently edited', hint: 'Default' },
  {
    value: 'recent',
    label: 'Recently useful',
    hint: 'Opened or edited',
  },
];

const GROUP_OPTIONS: { value: WallGroupBy; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'Flat wall' },
  { value: 'type', label: 'Type', hint: 'Cluster by product type' },
  { value: 'stock', label: 'Stock', hint: 'Cluster by location' },
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

  function toggle(key: (typeof SHOW_OPTIONS)[number]['key']) {
    onChange({ ...prefs, [key]: !prefs[key] });
  }

  function setSort(sort: WallSort) {
    if (prefs.sort === sort) return;
    onChange({ ...prefs, sort });
  }

  function setGroupBy(groupBy: WallGroupBy) {
    if (prefs.groupBy === groupBy) return;
    onChange({ ...prefs, groupBy });
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
          <p className={styles.menuTitle}>Order</p>
          <div className={styles.sortGroup} role="group" aria-label="Wall order">
            {SORT_OPTIONS.map((option) => {
              const selected = prefs.sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`${styles.sortItem} ${selected ? styles.sortItemActive : ''}`}
                  onClick={() => setSort(option.value)}
                >
                  <span className={styles.sortLabel}>{option.label}</span>
                  <span className={styles.sortHint}>{option.hint}</span>
                </button>
              );
            })}
          </div>

          <p className={styles.menuTitle}>Group by</p>
          <div className={styles.sortGroup} role="group" aria-label="Wall group by">
            {GROUP_OPTIONS.map((option) => {
              const selected = prefs.groupBy === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`${styles.sortItem} ${selected ? styles.sortItemActive : ''}`}
                  onClick={() => setGroupBy(option.value)}
                >
                  <span className={styles.sortLabel}>{option.label}</span>
                  <span className={styles.sortHint}>{option.hint}</span>
                </button>
              );
            })}
          </div>

          <p className={styles.menuTitle}>Show on cards</p>
          {SHOW_OPTIONS.map((option) => (
            <label key={option.key} className={styles.item} role="menuitemcheckbox">
              <input
                type="checkbox"
                checked={Boolean(prefs[option.key])}
                onChange={() => toggle(option.key)}
              />
              <span className={styles.itemLabel}>
                <span>{option.label}</span>
                {option.shortcut && (
                  <kbd className={styles.shortcut} aria-label={`Shortcut ${option.shortcut}`}>
                    {option.shortcut}
                  </kbd>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
