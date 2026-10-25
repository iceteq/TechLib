import { useEffect, useId, useRef, useState } from 'react';
import { ClipboardPaste, Clock, Plus, Search, X } from 'lucide-react';
import {
  loadRecentSearches,
  rememberSearch,
  removeRecentSearch,
} from '../../lib/recentSearches';
import { parseSearchList } from '../../lib/searchNotes';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  orTerms: string[];
  onOrTermsChange: (terms: string[]) => void;
}

const HIGHLIGHT_MS = 1600;
const UNDO_MS = 4000;

type UndoSnapshot = {
  orTerms: string[];
  /** When set, undo also puts this text back in the search field. */
  restoreValue?: string;
};

export function SearchBar({
  value,
  onChange,
  orTerms,
  onOrTermsChange,
}: SearchBarProps) {
  const listId = useId();
  const popoverId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [listDraft, setListDraft] = useState('');
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const [highlightedTerm, setHighlightedTerm] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  useEffect(() => {
    setRecent(loadRecentSearches());
  }, [value, orTerms]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
      if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!pasteOpen) return;
    textareaRef.current?.focus();
    const selected = textareaRef.current;
    if (selected) {
      const len = selected.value.length;
      selected.setSelectionRange(len, len);
    }
  }, [pasteOpen]);

  useEffect(() => {
    if (!pasteOpen) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPasteOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPasteOpen(false);
        inputRef.current?.focus();
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pasteOpen]);

  const trimmed = value.trim();
  const hasOrTerms = orTerms.length > 0;
  const canAddTerm = trimmed.length > 0;
  const recentVisible =
    focused && !pasteOpen
      ? recent.filter((item) => {
          const display = recentDisplay(item);
          return trimmed
            ? display.toLowerCase().includes(trimmed.toLowerCase()) &&
                display.toLowerCase() !== trimmed.toLowerCase()
            : true;
        })
      : [];

  const draftTerms = parseSearchList(listDraft);
  const canApplyList = draftTerms.length > 0;

  function commitRecent(query: string) {
    setRecent(rememberSearch(query));
  }

  function rememberList(terms: string[]) {
    if (terms.length === 0) return;
    commitRecent(terms.join('\n'));
  }

  function flashHighlight(term: string) {
    setHighlightedTerm(term);
    if (highlightTimer.current != null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedTerm(null);
      highlightTimer.current = null;
    }, HIGHLIGHT_MS);
  }

  function armUndo(previous: string[], restoreValue?: string) {
    setUndoSnapshot({ orTerms: previous, restoreValue });
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      undoTimer.current = null;
    }, UNDO_MS);
  }

  function clearUndo() {
    setUndoSnapshot(null);
    if (undoTimer.current != null) {
      window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }

  function addOrTerm(raw: string) {
    const term = raw.trim();
    if (!term) return;
    const exists = orTerms.some(
      (item) => item.toLowerCase() === term.toLowerCase(),
    );
    if (exists) {
      onChange('');
      flashHighlight(
        orTerms.find((item) => item.toLowerCase() === term.toLowerCase()) ??
          term,
      );
      return;
    }
    const previous = orTerms;
    const next = [...orTerms, term];
    onOrTermsChange(next);
    onChange('');
    rememberList(next);
    flashHighlight(term);
    // Undo removes the chip and puts the text back for a quick edit.
    armUndo(previous, term);
  }

  function undoLastChange() {
    if (!undoSnapshot) return;
    const { orTerms: restored, restoreValue } = undoSnapshot;
    clearUndo();
    setHighlightedTerm(null);
    onOrTermsChange(restored);
    if (restoreValue != null) onChange(restoreValue);
    if (restored.length > 0) rememberList(restored);
    inputRef.current?.focus();
  }

  function removeLastOrTerm() {
    if (orTerms.length === 0) return;
    clearUndo();
    const previous = orTerms;
    const next = orTerms.slice(0, -1);
    onOrTermsChange(next);
    // Keep a short undo so accidental backspace is recoverable.
    armUndo(previous);
    if (next.length > 0) {
      rememberList(next);
      flashHighlight(next[next.length - 1]!);
    } else {
      setHighlightedTerm(null);
    }
  }

  function applyRecent(query: string) {
    if (query.includes('\n')) {
      const terms = parseSearchList(query);
      const previous = orTerms;
      onChange('');
      onOrTermsChange(terms);
      rememberList(terms);
      setPasteOpen(false);
      setFocused(false);
      clearUndo();
      if (terms.length > 0) {
        flashHighlight(terms[terms.length - 1]!);
        armUndo(previous);
      }
      inputRef.current?.blur();
      return;
    }
    if (hasOrTerms) {
      addOrTerm(query);
      setFocused(false);
      inputRef.current?.focus();
      return;
    }
    clearUndo();
    onOrTermsChange([]);
    onChange(query);
    commitRecent(query);
    setPasteOpen(false);
    inputRef.current?.focus();
  }

  function clearValue() {
    clearUndo();
    setHighlightedTerm(null);
    if (hasOrTerms) {
      rememberList(orTerms);
      onOrTermsChange([]);
    } else if (trimmed) {
      commitRecent(trimmed);
    }
    onChange('');
    inputRef.current?.focus();
  }

  function openPaste() {
    setListDraft(orTerms.length > 0 ? orTerms.join('\n') : trimmed);
    setPasteOpen(true);
    setFocused(false);
  }

  function applyPasteList() {
    const terms = parseSearchList(listDraft);
    if (terms.length === 0) return;
    const previous = orTerms;
    onChange('');
    onOrTermsChange(terms);
    rememberList(terms);
    setPasteOpen(false);
    setFocused(false);
    flashHighlight(terms[terms.length - 1]!);
    armUndo(previous);
    inputRef.current?.blur();
  }

  function removeOrTerm(term: string) {
    clearUndo();
    const next = orTerms.filter((item) => item !== term);
    onOrTermsChange(next);
    if (highlightedTerm === term) setHighlightedTerm(null);
    if (next.length === 0) {
      inputRef.current?.focus();
    } else {
      rememberList(next);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div
        className={`${styles.field}${hasOrTerms ? ` ${styles.fieldListActive}` : ''}`}
      >
        <Search size={16} className={styles.icon} aria-hidden />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setPasteOpen(false);
          }}
          onBlur={() => {
            // Delay so recent-chip clicks register before the panel closes.
            window.setTimeout(() => setFocused(false), 120);
            if (!hasOrTerms && trimmed) commitRecent(trimmed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              if (value || hasOrTerms) {
                clearValue();
              } else {
                inputRef.current?.blur();
              }
              return;
            }
            if (e.key === 'Backspace' && !value && hasOrTerms) {
              e.preventDefault();
              removeLastOrTerm();
              return;
            }
            if (e.key === 'Enter' && trimmed) {
              e.preventDefault();
              // Enter and Shift+Enter both commit a list term — no mode switch.
              addOrTerm(trimmed);
              return;
            }
          }}
          placeholder={
            hasOrTerms ? 'Add another part…' : 'Search part numbers…'
          }
          aria-label={
            hasOrTerms
              ? 'Add part number to list search'
              : 'Search part numbers and notes'
          }
          aria-autocomplete="list"
          aria-controls={recentVisible.length > 0 ? listId : undefined}
          aria-expanded={recentVisible.length > 0}
        />
        <button
          type="button"
          className={styles.listBtn}
          onClick={() => addOrTerm(trimmed)}
          disabled={!canAddTerm}
          aria-label="Add search term to list"
          title="Add to list"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          className={`${styles.listBtn}${pasteOpen ? ` ${styles.listBtnActive}` : ''}`}
          onClick={() => (pasteOpen ? setPasteOpen(false) : openPaste())}
          aria-label="Paste a list of part numbers"
          aria-expanded={pasteOpen}
          aria-controls={popoverId}
          title="Paste a list"
        >
          <ClipboardPaste size={15} />
        </button>
        {(value || hasOrTerms) && (
          <button
            type="button"
            className={styles.clear}
            onClick={clearValue}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {(hasOrTerms || undoSnapshot) && (
        <div className={styles.orChips} aria-label="List search terms">
          {hasOrTerms && (
            <span className={styles.orCount}>
              {orTerms.length} part{orTerms.length === 1 ? '' : 's'}
            </span>
          )}
          {orTerms.map((term) => (
            <button
              key={term}
              type="button"
              className={`${styles.orChip}${
                highlightedTerm === term ? ` ${styles.orChipFresh}` : ''
              }`}
              onClick={() => removeOrTerm(term)}
              title={`Remove ${term}`}
              aria-label={`Remove ${term}`}
            >
              <span>{term}</span>
              <X size={12} aria-hidden />
            </button>
          ))}
          {undoSnapshot && (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={undoLastChange}
              aria-label="Undo last list change"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {pasteOpen && (
        <div
          id={popoverId}
          className={styles.listPopover}
          role="dialog"
          aria-label="Paste a list"
        >
          <div className={styles.listHeader}>
            <div>
              <p className={styles.listTitle}>Paste a list</p>
              <p className={styles.listHint}>One part number per line</p>
            </div>
            <button
              type="button"
              className={styles.clear}
              onClick={() => setPasteOpen(false)}
              aria-label="Close paste list"
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className={styles.listTextarea}
            value={listDraft}
            onChange={(e) => setListDraft(e.target.value)}
            placeholder={'HP-3209B\nELITEPOS-A1\nSCANNER-8800'}
            rows={6}
            spellCheck={false}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                applyPasteList();
              }
            }}
          />
          <div className={styles.listFooter}>
            <span className={styles.listMeta}>
              {draftTerms.length > 0
                ? `${draftTerms.length} term${draftTerms.length === 1 ? '' : 's'}`
                : 'Paste from a spreadsheet'}
            </span>
            <div className={styles.listActions}>
              <button
                type="button"
                className={styles.listCancel}
                onClick={() => setPasteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.listApply}
                disabled={!canApplyList}
                onClick={applyPasteList}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      {recentVisible.length > 0 && (
        <div
          id={listId}
          className={styles.recent}
          role="listbox"
          aria-label="Recent searches"
        >
          {recentVisible.map((item) => (
            <div key={item} className={styles.recentRow} role="option">
              <button
                type="button"
                className={styles.recentBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyRecent(item)}
              >
                <Clock size={14} aria-hidden />
                <span>{recentDisplay(item)}</span>
              </button>
              <button
                type="button"
                className={styles.recentRemove}
                aria-label={`Remove ${recentDisplay(item)} from recent searches`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setRecent(removeRecentSearch(item))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function recentDisplay(item: string): string {
  return item.includes('\n')
    ? item.split(/\r?\n/).filter(Boolean).join(' · ')
    : item;
}
