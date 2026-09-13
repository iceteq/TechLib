import { useEffect, useId, useRef, useState } from 'react';
import { Clock, Search, X } from 'lucide-react';
import {
  loadRecentSearches,
  rememberSearch,
  removeRecentSearch,
} from '../../lib/recentSearches';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());

  useEffect(() => {
    setRecent(loadRecentSearches());
  }, [value]);

  const trimmed = value.trim();
  const recentVisible = focused
    ? recent.filter((item) =>
        trimmed
          ? item.toLowerCase().includes(trimmed.toLowerCase()) &&
            item.toLowerCase() !== trimmed.toLowerCase()
          : true,
      )
    : [];

  function commitRecent(query: string) {
    setRecent(rememberSearch(query));
  }

  function applyRecent(query: string) {
    onChange(query);
    commitRecent(query);
    inputRef.current?.focus();
  }

  function clearValue() {
    if (trimmed) commitRecent(trimmed);
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.field}>
        <Search size={16} className={styles.icon} aria-hidden />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so recent-chip clicks register before the panel closes.
            window.setTimeout(() => setFocused(false), 120);
            if (trimmed) commitRecent(trimmed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              if (value) {
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
          placeholder="Search part numbers…"
          aria-label="Search part numbers and notes"
          aria-autocomplete="list"
          aria-controls={recentVisible.length > 0 ? listId : undefined}
          aria-expanded={recentVisible.length > 0}
        />
        {value && (
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
                <span>{item}</span>
              </button>
              <button
                type="button"
                className={styles.recentRemove}
                aria-label={`Remove ${item} from recent searches`}
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
