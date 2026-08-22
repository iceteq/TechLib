import type { Reaction, ReactionEmoji } from '../../lib/types';
import { REACTION_EMOJIS } from '../../lib/types';
import styles from './ReactionBar.module.css';

interface ReactionBarProps {
  reactions: Reaction[];
  onToggle: (emoji: ReactionEmoji) => void;
}

export function ReactionBar({ reactions, onToggle }: ReactionBarProps) {
  const byEmoji = new Map(reactions.map((r) => [r.emoji, r.count]));

  return (
    <div className={styles.bar} role="group" aria-label="Reactions">
      {REACTION_EMOJIS.map((emoji) => {
        const count = byEmoji.get(emoji) ?? 0;
        const active = count > 0;
        return (
          <button
            key={emoji}
            type="button"
            className={`${styles.chip} ${active ? styles.active : ''}`}
            onClick={() => onToggle(emoji)}
            aria-pressed={active}
            aria-label={`React with ${emoji}`}
          >
            <span aria-hidden>{emoji}</span>
            {count > 0 && <span className={styles.count}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
