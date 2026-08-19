import { useMemo, useRef, useState } from 'react';
import { Hash, Plus, Tag } from 'lucide-react';
import type { Label } from '../../lib/types';
import { LabelChip } from './LabelChip';
import styles from './LabelPicker.module.css';

interface LabelPickerProps {
  labels: Label[];
  selectedIds: string[];
  onChange: (labelIds: string[]) => void;
  onCreateLabel: (name: string) => Promise<Label>;
}

function normalizeLabelQuery(raw: string) {
  return raw.trim().replace(/^#+/, '');
}

export function LabelPicker({
  labels,
  selectedIds,
  onChange,
  onCreateLabel,
}: LabelPickerProps) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => labels.filter((l) => selectedIds.includes(l.id)),
    [labels, selectedIds],
  );

  const normalized = normalizeLabelQuery(query);

  const suggestions = useMemo(() => {
    const q = normalized.toLowerCase();
    const available = labels.filter((l) => !selectedIds.includes(l.id));
    if (!q) return available.slice(0, 8);
    return available
      .filter((l) => l.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return aName.localeCompare(bName);
      })
      .slice(0, 8);
  }, [labels, normalized, selectedIds]);

  const canCreate = useMemo(() => {
    if (!normalized) return false;
    return !labels.some(
      (l) => l.name.toLowerCase() === normalized.toLowerCase(),
    );
  }, [labels, normalized]);

  const optionCount = suggestions.length + (canCreate ? 1 : 0);
  const showMenu = open && optionCount > 0;

  async function addLabel(label: Label) {
    if (selectedIds.includes(label.id)) return;
    onChange([...selectedIds, label.id]);
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  }

  async function createAndAdd() {
    if (!normalized || busy) return;
    setBusy(true);
    try {
      const label = await onCreateLabel(normalized);
      onChange([...selectedIds, label.id]);
      setQuery('');
      setHighlight(0);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function removeLabel(id: string) {
    onChange(selectedIds.filter((lid) => lid !== id));
  }

  function commitHighlighted() {
    if (highlight < suggestions.length) {
      void addLabel(suggestions[highlight]);
      return;
    }
    if (canCreate) void createAndAdd();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.selected}>
        {selected.map((label) => (
          <LabelChip
            key={label.id}
            name={label.name}
            onRemove={() => removeLabel(label.id)}
          />
        ))}
      </div>

      <div className={`${styles.inputRow} ${open ? styles.inputRowFocus : ''}`}>
        <Hash size={16} className={styles.inputIcon} />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              if (!showMenu) return;
              e.preventDefault();
              setHighlight((h) => (h + 1) % optionCount);
            } else if (e.key === 'ArrowUp') {
              if (!showMenu) return;
              e.preventDefault();
              setHighlight((h) => (h - 1 + optionCount) % optionCount);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              commitHighlighted();
            } else if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
            } else if (e.key === 'Backspace' && !query && selectedIds.length) {
              removeLabel(selectedIds[selectedIds.length - 1]);
            }
          }}
          placeholder="Type #label or create one"
          aria-label="Add label"
          aria-expanded={showMenu}
          aria-autocomplete="list"
        />
      </div>

      {showMenu && (
        <ul className={styles.menu} role="listbox">
          {suggestions.map((label, index) => (
            <li key={label.id}>
              <button
                type="button"
                className={`${styles.option} ${
                  highlight === index ? styles.optionActive : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => void addLabel(label)}
              >
                <Tag size={14} />
                <span>
                  <span className={styles.hash}>#</span>
                  {label.name}
                </span>
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                className={`${styles.option} ${
                  highlight === suggestions.length ? styles.optionActive : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(suggestions.length)}
                onClick={() => void createAndAdd()}
                disabled={busy}
              >
                <Plus size={14} />
                Create “{normalized}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
