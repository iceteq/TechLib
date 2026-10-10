import { useEffect, useId, useRef, useState } from 'react';
import { Clock, List, Search, X } from 'lucide-react';
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
  const [focused, setFocused] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listDraft, setListDraft] = useState('');
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());

  useEffect(() => {
    setRecent(loadRecentSearches());
  }, [value, orTerms]);

  useEffect(() => {
    if (!listOpen) return;
    textareaRef.current?.focus();
    const selected = textareaRef.current;
    if (selected) {
      const len = selected.value.length;
      selected.setSelectionRange(len, len);
    }
  }, [listOpen]);

  useEffect(() => {
    if (!listOpen) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setListOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setListOpen(false);
        inputRef.current?.focus();
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [listOpen]);

  const trimmed = value.trim();
  const hasOrTerms = orTerms.length > 0;
  // Hide recent while a list (OR) search is active so chips stay readable.
  const recentVisible =
    focused && !listOpen && !hasOrTerms
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

  function applyRecent(query: string) {
    if (query.includes('\n')) {
      const terms = parseSearchList(query);
      onChange('');
      onOrTermsChange(terms);
      commitRecent(terms.join('\n'));
      setListOpen(false);
      setFocused(false);
      inputRef.current?.blur();
      return;
    }
    onOrTermsChange([]);
    onChange(query);
    commitRecent(query);
    setListOpen(false);
    inputRef.current?.focus();
  }

  function clearValue() {
    if (hasOrTerms) {
      commitRecent(orTerms.join('\n'));
      onOrTermsChange([]);
    } else if (trimmed) {
      commitRecent(trimmed);
    }
    onChange('');
    inputRef.current?.focus();
  }

  function openList() {
    setListDraft(orTerms.length > 0 ? orTerms.join('\n') : trimmed);
    setListOpen(true);
    setFocused(false);
  }

  function applyList() {
    const terms = parseSearchList(listDraft);
    if (terms.length === 0) return;
    onChange('');
    onOrTermsChange(terms);
    commitRecent(terms.join('\n'));
    setListOpen(false);
    setFocused(false);
    inputRef.current?.blur();
  }

  function removeOrTerm(term: string) {
    const next = orTerms.filter((item) => item !== term);
    onOrTermsChange(next);
    if (next.length === 0) {
      inputRef.current?.focus();
    }
  }

  function handleInputChange(next: string) {
    if (hasOrTerms) onOrTermsChange([]);
    onChange(next);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.field}>
        <Search size={16} className={styles.icon} aria-hidden />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setListOpen(false);
          }}
          onBlur={() => {
            // Delay so recent-chip clicks register before the panel closes.
            window.setTimeout(() => setFocused(false), 120);
            if (trimmed) commitRecent(trimmed);
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
            if (e.key === 'Enter' && trimmed) {
              e.preventDefault();
              commitRecent(trimmed);
              inputRef.current?.blur();
            }
          }}
          placeholder={
            hasOrTerms ? `${orTerms.length} parts…` : 'Search part numbers…'
          }
          aria-label="Search part numbers and notes"
          aria-autocomplete="list"
          aria-controls={recentVisible.length > 0 ? listId : undefined}
          aria-expanded={recentVisible.length > 0}
        />
        <button
          type="button"
          className={`${styles.listBtn}${listOpen || hasOrTerms ? ` ${styles.listBtnActive}` : ''}`}
          onClick={() => (listOpen ? setListOpen(false) : openList())}
          aria-label="Search a list of part numbers"
          aria-expanded={listOpen}
          aria-controls={popoverId}
          title="Search a list"
        >
          <List size={15} />
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

      {hasOrTerms && (
        <div className={styles.orChips} aria-label="List search terms">
          <span className={styles.orCount}>
            {orTerms.length} part{orTerms.length === 1 ? '' : 's'}
          </span>
          {orTerms.map((term) => (
            <button
              key={term}
              type="button"
              className={styles.orChip}
              onClick={() => removeOrTerm(term)}
              title={`Remove ${term}`}
              aria-label={`Remove ${term}`}
            >
              <span>{term}</span>
              <X size={12} aria-hidden />
            </button>
          ))}
        </div>
      )}

      {listOpen && (
        <div
          id={popoverId}
          className={styles.listPopover}
          role="dialog"
          aria-label="Search a list"
        >
          <div className={styles.listHeader}>
            <div>
              <p className={styles.listTitle}>Search a list</p>
              <p className={styles.listHint}>One part number per line</p>
            </div>
            <button
              type="button"
              className={styles.clear}
              onClick={() => setListOpen(false)}
              aria-label="Close list search"
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
                applyList();
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
                onClick={() => setListOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.listApply}
                disabled={!canApplyList}
                onClick={applyList}
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
  return item.includes('\n') ? item.split(/\r?\n/).filter(Boolean).join(' · ') : item;
}
