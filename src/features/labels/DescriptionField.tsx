import { useMemo, useRef, useState } from 'react';
import { Hash, Plus } from 'lucide-react';
import type { Label } from '../../lib/types';
import styles from './DescriptionField.module.css';

interface DescriptionFieldProps {
  value: string;
  labels: Label[];
  selectedIds: string[];
  onChange: (value: string) => void;
  onBlur: () => void;
  onAddLabel: (label: Label) => void;
  onCreateLabel: (name: string) => Promise<Label>;
}

function activeHashToken(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const match = before.match(/#([^\s#]*)$/);
  if (!match) return null;
  return {
    raw: match[0],
    query: match[1],
    start: cursor - match[0].length,
    end: cursor,
  };
}

export function DescriptionField({
  value,
  labels,
  selectedIds,
  onChange,
  onBlur,
  onAddLabel,
  onCreateLabel,
}: DescriptionFieldProps) {
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const token = useMemo(() => activeHashToken(value, cursor), [value, cursor]);

  const suggestions = useMemo(() => {
    if (!token) return [];
    const q = token.query.toLowerCase();
    const available = labels.filter((l) => !selectedIds.includes(l.id));
    if (!q) return available.slice(0, 6);
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
      .slice(0, 6);
  }, [labels, selectedIds, token]);

  const canCreate = useMemo(() => {
    if (!token?.query.trim()) return false;
    const name = token.query.trim();
    return !labels.some((l) => l.name.toLowerCase() === name.toLowerCase());
  }, [labels, token]);

  const showMenu = open && token !== null && (suggestions.length > 0 || canCreate);
  const optionCount = suggestions.length + (canCreate ? 1 : 0);

  async function applyLabel(label: Label) {
    if (!token) return;
    const cleaned = `${value.slice(0, token.start)}${value.slice(token.end)}`
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^\s+/, '');
    onChange(cleaned);
    onAddLabel(label);
    setOpen(false);
    setHighlight(0);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = Math.min(token.start, cleaned.length);
      el.focus();
      el.setSelectionRange(pos, pos);
      setCursor(pos);
    });
  }

  async function createLabel() {
    if (!token || !canCreate || busy) return;
    setBusy(true);
    try {
      const label = await onCreateLabel(token.query.trim());
      await applyLabel(label);
    } finally {
      setBusy(false);
    }
  }

  function commitHighlight() {
    if (highlight < suggestions.length) {
      void applyLabel(suggestions[highlight]);
      return;
    }
    if (canCreate) void createLabel();
  }

  return (
    <div className={styles.wrap}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        rows={5}
        placeholder="Take a note… type # for labels"
        aria-label="Note description"
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(e.target.selectionStart);
          setOpen(true);
          setHighlight(0);
        }}
        onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
        onClick={(e) => setCursor(e.currentTarget.selectionStart)}
        onKeyUp={(e) => setCursor(e.currentTarget.selectionStart)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            onBlur();
          }, 140);
        }}
        onKeyDown={(e) => {
          if (!showMenu) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (h + 1) % optionCount);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (h - 1 + optionCount) % optionCount);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            commitHighlight();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />

      {showMenu && token && (
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
                onClick={() => void applyLabel(label)}
              >
                <Hash size={14} />
                {label.name}
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
                onClick={() => void createLabel()}
                disabled={busy}
              >
                <Plus size={14} />
                Create “{token.query.trim()}”?
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
