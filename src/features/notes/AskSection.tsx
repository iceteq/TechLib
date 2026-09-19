import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { generateAskAnswer } from '../../lib/noteAsk';
import {
  createEmptyAskItem,
  MAX_NOTE_ASK_ITEMS,
  MAX_NOTE_ASK_QUESTION_LEN,
  normalizeAskItems,
} from '../../lib/noteAskItems';
import type { NoteAskItem } from '../../lib/types';
import styles from './AskSection.module.css';

const PLACEHOLDERS = [
  'What is CEE 7 and how do you recognize it?',
  'What can this be mixed up with?',
  'What is special about G8?',
];

const EXAMPLES = [
  'What is … and how do you recognize it?',
  'What can this be mixed up with?',
  'What is special about …?',
];

interface AskSectionProps {
  items: NoteAskItem[];
  /** Product type name only — never title/description. */
  typeName: string | null;
  /** Admins can add/edit/generate; everyone else read-only. */
  canManage: boolean;
  onChange: (items: NoteAskItem[]) => Promise<void>;
}

export function AskSection({
  items,
  typeName,
  canManage,
  onChange,
}: AskSectionProps) {
  const examplesId = useId();
  const [draft, setDraft] = useState(() => normalizeAskItems(items));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const placeholder =
    PLACEHOLDERS[draft.length % PLACEHOLDERS.length] ?? PLACEHOLDERS[0];

  useEffect(() => {
    setDraft(normalizeAskItems(items));
  }, [items]);

  useEffect(() => {
    if (!editingAnswerId) return;
    answerRef.current?.focus();
  }, [editingAnswerId]);

  const hasContent = draft.some(
    (item) => item.question.trim() || item.answer.trim(),
  );

  if (!canManage && !hasContent) return null;

  async function persist(next: NoteAskItem[]) {
    const normalized = normalizeAskItems(next);
    setDraft(normalized);
    await onChange(normalized);
  }

  function setLocal(next: NoteAskItem[]) {
    // Don't trim while typing — trailing spaces would vanish on every keystroke.
    setDraft(normalizeAskItems(next, { trim: false }));
  }

  async function addItem(preset?: string) {
    if (!canManage || draft.length >= MAX_NOTE_ASK_ITEMS) return;
    const item = createEmptyAskItem();
    if (preset) item.question = preset;
    setExamplesOpen(false);
    await persist([...draft, item]);
  }

  async function removeItem(id: string) {
    if (!canManage) return;
    if (editingAnswerId === id) setEditingAnswerId(null);
    await persist(draft.filter((item) => item.id !== id));
  }

  async function commitItem(id: string, patch: Partial<NoteAskItem>) {
    if (!canManage) return;
    const next = draft.map((item) => {
      if (item.id !== id) return item;
      const question =
        patch.question !== undefined
          ? patch.question.trim().slice(0, MAX_NOTE_ASK_QUESTION_LEN)
          : item.question;
      const answer =
        patch.answer !== undefined ? patch.answer.trim() : item.answer;
      return {
        ...item,
        ...patch,
        question,
        answer,
        answeredAt:
          patch.answeredAt !== undefined
            ? patch.answeredAt
            : answer
              ? (item.answeredAt ?? Date.now())
              : null,
      };
    });
    await persist(next);
  }

  async function ask(item: NoteAskItem) {
    if (!canManage) return;
    const question = item.question.trim();
    if (!question) {
      setErrorById((prev) => ({
        ...prev,
        [item.id]: 'Enter a question first.',
      }));
      return;
    }
    if (!typeName?.trim()) {
      setErrorById((prev) => ({
        ...prev,
        [item.id]: 'Set a type on the note first.',
      }));
      return;
    }

    setBusyId(item.id);
    setEditingAnswerId(null);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      const answer = await generateAskAnswer({
        question,
        typeName: typeName.trim(),
      });
      await commitItem(item.id, {
        question,
        answer,
        answeredAt: Date.now(),
      });
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [item.id]:
          err instanceof Error ? err.message : 'Failed to generate answer.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  // Collapsed empty state — matches “Add definitions / notes”.
  if (canManage && draft.length === 0) {
    return (
      <div className={styles.wrap}>
        <button
          type="button"
          className={styles.addLink}
          onClick={() => void addItem()}
        >
          Add ask
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className={styles.label}>Ask</p>
        {canManage && !typeName?.trim() && (
          <p className={styles.hint}>Set a type to generate answers.</p>
        )}
      </div>

      <ul className={styles.list}>
        {draft.map((item, index) => {
          const busy = busyId === item.id;
          const error = errorById[item.id];
          const editingAnswer = editingAnswerId === item.id;
          const questionPlaceholder =
            index === 0 ? placeholder : PLACEHOLDERS[index % PLACEHOLDERS.length];

          return (
            <li key={item.id} className={styles.row}>
              {canManage ? (
                <div className={styles.questionRow}>
                  <input
                    className={styles.question}
                    value={item.question}
                    maxLength={MAX_NOTE_ASK_QUESTION_LEN}
                    placeholder={questionPlaceholder}
                    aria-label="Ask question"
                    disabled={busy}
                    onChange={(e) => {
                      setLocal(
                        draft.map((row) =>
                          row.id === item.id
                            ? {
                                ...row,
                                question: e.target.value.slice(
                                  0,
                                  MAX_NOTE_ASK_QUESTION_LEN,
                                ),
                                answer: '',
                                answeredAt: null,
                              }
                            : row,
                        ),
                      );
                    }}
                    onBlur={(e) => {
                      void commitItem(item.id, {
                        question: e.target.value,
                      });
                    }}
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.askBtn}
                      disabled={busy || !item.question.trim()}
                      onClick={() => void ask(item)}
                      title={item.answer ? 'Refresh answer' : 'Ask'}
                    >
                      {busy ? (
                        <Loader2
                          size={14}
                          className={styles.spin}
                          aria-hidden
                        />
                      ) : (
                        <Sparkles size={14} aria-hidden />
                      )}
                      <span>{busy ? '…' : item.answer ? 'Refresh' : 'Ask'}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label="Remove ask"
                      disabled={busy}
                      onClick={() => void removeItem(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                item.question.trim() && (
                  <p className={styles.questionRead}>{item.question}</p>
                )
              )}

              {error && <p className={styles.error}>{error}</p>}

              {busy && (
                <p className={styles.thinking} role="status">
                  Thinking…
                </p>
              )}

              {!busy &&
                canManage &&
                (editingAnswer ? (
                  <textarea
                    ref={answerRef}
                    className={styles.answerEdit}
                    value={item.answer}
                    rows={2}
                    placeholder="Short answer…"
                    aria-label="Ask answer"
                    onChange={(e) => {
                      setLocal(
                        draft.map((row) =>
                          row.id === item.id
                            ? {
                                ...row,
                                answer: e.target.value,
                                answeredAt: e.target.value.trim()
                                  ? Date.now()
                                  : null,
                              }
                            : row,
                        ),
                      );
                    }}
                    onBlur={(e) => {
                      setEditingAnswerId(null);
                      void commitItem(item.id, { answer: e.target.value });
                    }}
                  />
                ) : (
                  item.answer.trim() && (
                    <button
                      type="button"
                      className={styles.answerButton}
                      onClick={() => setEditingAnswerId(item.id)}
                    >
                      <span className={styles.answerMark} aria-hidden>
                        AI
                      </span>
                      <span className={styles.answerText}>{item.answer}</span>
                    </button>
                  )
                ))}

              {!busy && !canManage && item.answer.trim() && (
                <p className={styles.answerRead}>
                  <span className={styles.answerMark} aria-hidden>
                    AI
                  </span>
                  {item.answer}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {canManage && draft.length < MAX_NOTE_ASK_ITEMS && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.addLink}
            onClick={() => void addItem()}
          >
            Add another ask
          </button>
          <div className={styles.examplesWrap}>
            <button
              type="button"
              className={styles.examplesToggle}
              aria-expanded={examplesOpen}
              aria-controls={examplesId}
              onClick={() => setExamplesOpen((open) => !open)}
            >
              {examplesOpen ? 'Hide examples' : 'Examples'}
            </button>
            {examplesOpen && (
              <ul id={examplesId} className={styles.examples}>
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      className={styles.exampleItem}
                      onClick={() => void addItem(example)}
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
