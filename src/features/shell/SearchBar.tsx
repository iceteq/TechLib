import { Search, X } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className={styles.wrap}>
      <Search size={16} className={styles.icon} aria-hidden />
      <input
        className={styles.input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search notes…"
        aria-label="Search notes"
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
