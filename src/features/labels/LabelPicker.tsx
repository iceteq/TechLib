import { useMemo, useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import type { Label } from '../../lib/types';
import { LabelChip } from './LabelChip';
import styles from './LabelPicker.module.css';

interface LabelPickerProps {
  labels: Label[];
  selectedIds: string[];
  onChange: (labelIds: string[]) => void;
  onCreateLabel: (name: string) => Promise<Label>;
}

export function LabelPicker({
  labels,
  selectedIds,
  onChange,
  onCreateLabel,
}: LabelPickerProps) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => labels.filter((l) => selectedIds.includes(l.id)),
    [labels, selectedIds],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (!q) {
      return labels.filter((l) => !selectedIds.includes(l.id)).slice(0, 6);
    }
    return labels
      .filter(
        (l) =>
          !selectedIds.includes(l.id) &&
          l.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [labels, query, selectedIds]);

  const canCreate = useMemo(() => {
    const name = query.trim().replace(/^#/, '');
    if (!name) return false;
    return !labels.some((l) => l.name.toLowerCase() === name.toLowerCase());
  }, [labels, query]);

  async function addLabel(label: Label) {
    if (selectedIds.includes(label.id)) return;
    onChange([...selectedIds, label.id]);
    setQuery('');
  }

  async function createAndAdd() {
    const name = query.trim().replace(/^#/, '');
    if (!name || busy) return;
    setBusy(true);
    try {
      const label = await onCreateLabel(name);
      onChange([...selectedIds, label.id]);
      setQuery('');
    } finally {
      setBusy(false);
    }
  }

  function removeLabel(id: string) {
    onChange(selectedIds.filter((lid) => lid !== id));
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

      <div className={styles.inputRow}>
        <Tag size={16} className={styles.inputIcon} />
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions[0]) {
                void addLabel(suggestions[0]);
              } else if (canCreate) {
                void createAndAdd();
              }
            }
          }}
          placeholder="Add label… try #warehouse"
          aria-label="Add label"
        />
      </div>

      {(suggestions.length > 0 || canCreate) && (
        <ul className={styles.menu} role="listbox">
          {suggestions.map((label) => (
            <li key={label.id}>
              <button
                type="button"
                className={styles.option}
                onClick={() => void addLabel(label)}
              >
                <Tag size={14} />
                {label.name}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                className={styles.option}
                onClick={() => void createAndAdd()}
                disabled={busy}
              >
                <Plus size={14} />
                Create “{query.trim().replace(/^#/, '')}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
